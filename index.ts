import { argv } from "node:process";

const PAT_TOKEN = argv[2];
const PROJECT = argv[3];
const WORK_ITEM_IDS = argv[4] || "";
const WORK_ITEM_INTENDED_STATUS = argv[5] || "";
const WORK_ITEM_STATUS_ORDER = argv[6]?.split(",").map((e) => `${e}`.trim()) || [];
const CODE_REVIEW_STATE_NAME = `${argv[7]}`.trim();
const ALLOW_STATUS_BACKFLOW = argv[8]?.toLocaleLowerCase() === "true";

const changeTicketStatus = async (
  itemId: string | undefined,
  status: string | undefined
) => {
  if (!itemId) {
    console.error("Item ID is required");
    return;
  }
  const formattedStatus = WORK_ITEM_STATUS_ORDER.find(
    (s) => s.toUpperCase() === `${status}`.toUpperCase()
  );
  if (!formattedStatus) {
    throw new Error("Invalid status provided");
  }
  const ticketInfo = await fetchTicket(itemId);
  if (!ticketInfo) {
    throw new Error("Ticket not found");
  }
  const currentStatus = ticketInfo.fields["System.State"];
  if (currentStatus === formattedStatus) {
    console.log("Ticket already in the correct status");
    return;
  }

  const targetStatusIndex = WORK_ITEM_STATUS_ORDER.indexOf(formattedStatus);
  const currentStatusIndex = WORK_ITEM_STATUS_ORDER.indexOf(currentStatus);
  const isFlowingBackwards = targetStatusIndex < currentStatusIndex;
  if (isFlowingBackwards && !ALLOW_STATUS_BACKFLOW) {
    console.error("Cannot change to a previous status");
    return;
  }

  const githubPRs = ticketInfo.relations.filter((r:any) => r.rel === "ArtifactLink" && r.attributes["name"] === "GitHub Pull Request");
  // By the time this runs, this PR shoudl already be linked to the ticket. So we should only halt if there is more than one PR linked.
  if (githubPRs.length > 1 && !isFlowingBackwards && targetStatusIndex > WORK_ITEM_STATUS_ORDER.indexOf(CODE_REVIEW_STATE_NAME) ) {
    console.error(`Ticket ${itemId} has multiple GitHub PRs linked, cannot automatically change status to ${formattedStatus}`);
    return;
  }

  const statusList =
    targetStatusIndex < currentStatusIndex && ALLOW_STATUS_BACKFLOW
      ? WORK_ITEM_STATUS_ORDER.toReversed()
      : WORK_ITEM_STATUS_ORDER;

  await stepThroughStatuses(currentStatus, formattedStatus, itemId, statusList);
  console.log(`Ticket ${itemId} status changed to ${formattedStatus}`);
};

const stepThroughStatuses = async (
  currentStatus: string,
  targetStatus: string,
  itemId: string,
  statusList: string[]
) => {
  const targetStatusIndex = statusList.indexOf(targetStatus);
  const currentStatusIndex = statusList.indexOf(currentStatus);
  for (let i = currentStatusIndex + 1; i <= targetStatusIndex; i++) {
    const nextStatus = statusList[i];
    if (nextStatus) {
      try {
        await updateTicketStatus(itemId, nextStatus);
      } catch (error) {
        console.error(error);
        return;
      }
    }
  }
};

const updateTicketStatus = async (itemId: string, status: string) => {
  const payload = [{ op: "add", path: "/fields/System.State", value: status }];
  const result = await patch(
    `https://dev.azure.com/thekeyholdingcompany/${PROJECT}/_apis/wit/workitems/${itemId}?api-version=5.1`,
    payload
  );
  const data: any = await result.json();
  if (result.status !== 200) {
    throw new Error(
      `Error updating ticket ${itemId} status to ${status}: ${JSON.stringify(
        data
      )}`
    );
  }
};

const fetchTicket = async (id: string) => {
  const result = await get(
    `https://dev.azure.com/thekeyholdingcompany/${PROJECT}/_apis/wit/workitems/${id}?api-version=5.1&$expand=relations`
  );
  const data: any = await result.json();
  if (result.status !== 200) {
    throw new Error(`Error fetching ticket ${id}: ${JSON.stringify(data)}`);
  }
  return data;
};

const patch = async (url: string, payload: Object) => {
  return await request("patch", url, payload);
};

const get = async (url: string) => {
  return await request("get", url, null);
};

const request = async (method: string, url: string, payload: Object | null) => {
  const token = btoa(`:${PAT_TOKEN}`);
  const config: any = {
    method: method.toUpperCase(),
    headers: {
      "Content-Type":
        method === "patch" ? "application/json-patch+json" : "application/json",
      Authorization: `Basic ${token}`,
    },
  };
  if (method !== "get" && payload) {
    config["body"] = JSON.stringify(payload);
  }

  try {
    return await fetch(url, config);
  } catch (error) {
    console.error(`Error making request to ${url}: ${error}`);
    console.log("Retrying...");
    return await fetch(url, config);
  }
};

WORK_ITEM_IDS.split(",").forEach((itemId) => {
  const _itemId = (
    itemId.includes("#") ? `${itemId.split("#")[1]}` : itemId
  ).trim();
  changeTicketStatus(_itemId, WORK_ITEM_INTENDED_STATUS).catch((error) => {
    console.error(`Error processing ticket ${_itemId}: ${error}`);
  });
});
