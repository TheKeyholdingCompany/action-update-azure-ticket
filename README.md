# Update an Azure Boards' ticket's status

## Usage

```yml
- name: Update ticket to "status"
  uses: TheKeyholdingCompany/action-update-azure-ticket@0.0.1
  with:
    pat: your-azure-pat-here
    project: your-project-name  # Project ID also works
    ticket-id: your-ticket-id
    status: your-status-here  # case insensitive, but must match an existing state
    status-order-list: comma-separated-list-of-statuses  # optional, but recommended
```

The default value for `status-order-list` is `"New,In Progress,Code Review,Ready for QA,In QA,Ready for regression,Ready for Deploy,Done"`.

This is recommended in case you have rules that restrict the which statuses can flow to which other statuses.

### Example
```yml
name: Move ticket development status
on:
  pull_request:
    branches:
      - main
  push:
    branch-ignore:
      - main

jobs:
  update-ticket:
    environment: testing
    timeout-minutes: 5
    runs-on: ubuntu-latest
    steps:
      - run: echo "Updating ticket..."

      - name: Find ticket ID (pull request)
        id: pr_find_ticket
        if: github.event_name == 'pull_request'
        run: |
          echo "${{ github.event.pull_request.body }}" | grep -o 'AB#[0-9]*' | awk -F 'AB#' '{print $2}'

      - name: Update ticket to "Code Review"
        if: github.event_name == 'pull_request'
        uses: TheKeyholdingCompany/action-update-azure-ticket@0.0.1
        with:
          pat: ${{ secrets.AZURE_PAT }}
          project: Keystone
          ticket-id: 1234
          status: Code Review
          status-order-list: New,In Progress,Code Review,Ready for QA,In QA,Ready for regression,Ready for Deploy,Done

      - name: Find ticket ID (commit)
        id: commit_find_ticket
        if: github.event_name == 'push'
        run: |
          echo "${{ github.event.head_commit.message }}" | grep -o 'AB#[0-9]*' | awk -F 'AB#' '{print $2}'

      - name: Update ticket to "In Progress"
        if: github.event_name == 'push'
        uses: TheKeyholdingCompany/action-update-azure-ticket@0.0.1
        with:
          pat: ${{ secrets.AZURE_PAT }}
          project: Keystone
          ticket-id: 1234
          status: In Progress
          status-order-list: New,In Progress,Code Review,Ready for QA,In QA,Ready for regression,Ready for Deploy,Done
```

