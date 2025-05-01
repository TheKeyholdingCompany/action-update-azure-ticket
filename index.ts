import { argv } from "node:process";
import axios from "axios";
const https = require("https");

const PAT_TOKEN = argv[2];
const PROJECT = argv[3];
const WORK_ITEM_IDS = argv[4] || "";
const WORK_ITEM_INTENDED_STATUS = argv[5] || "";
const WORK_ITEM_STATUS_ORDER =
  argv[6]?.split(",").map((e) => `${e}`.trim()) || [];

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

  const statusIndex = WORK_ITEM_STATUS_ORDER.indexOf(formattedStatus);
  const currentStatusIndex = WORK_ITEM_STATUS_ORDER.indexOf(currentStatus);
  if (statusIndex < currentStatusIndex) {
    console.error("Cannot change to a previous status");
  }

  for (let i = currentStatusIndex + 1; i <= statusIndex; i++) {
    const nextStatus = WORK_ITEM_STATUS_ORDER[i];
    if (nextStatus) {
      try {
        await updateTicketStatus(itemId, nextStatus);
      } catch (error) {
        console.error(
          `Error updating ticket ${itemId} status to ${nextStatus}: ${error}`
        );
        return;
      }
    }
  }
  console.log(`Ticket ${itemId} status changed to ${formattedStatus}`);
};

const updateTicketStatus = async (itemId: string, status: string) => {
  const payload = [{ op: "add", path: "/fields/System.State", value: status }];
  const result = await patch(
    `https://dev.azure.com/thekeyholdingcompany/${PROJECT}/_apis/wit/workitems/${itemId}?api-version=5.1`,
    payload
  );
  if (result.status !== 200) {
    throw new Error(
      `Error updating ticket ${itemId} status to ${status}: ${result.data?.message}`
    );
  }
};

const fetchTicket = async (id: string) => {
  const ticketInfo = await get(
    `https://dev.azure.com/thekeyholdingcompany/${PROJECT}/_apis/wit/workitems/${id}?api-version=5.1&$expand=relations`
  );
  return ticketInfo.data;
};

const patch = async (url: string, payload: Object) => {
  return await request("patch", url, payload);
};

const get = async (url: string) => {
  return await request("get", url, null);
};

const request = async (method: string, url: string, payload: Object | null) => {
  const token = btoa(`:${PAT_TOKEN}`);
  const config = {
    method: method,
    maxBodyLength: Infinity,
    url,
    headers: {
      "Content-Type":
        method === "patch" ? "application/json-patch+json" : "application/json",
      Authorization: `Basic ${token}`,
    },
    data: JSON.stringify(payload),
    httpsAgent: new https.Agent({
      maxVersion: "TLSv1.2",
      minVersion: "TLSv1.2"
    })
  };

  return await axios.request(config);
};

WORK_ITEM_IDS.split(",").forEach((itemId) => {
  const _itemId = (itemId.includes("#") ? `${itemId.split("#")[1]}` : itemId).trim();
  changeTicketStatus(_itemId, WORK_ITEM_INTENDED_STATUS);
})
