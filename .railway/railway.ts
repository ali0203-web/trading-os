import { defineRailway, project, service, database } from "railway/iac";

export default defineRailway(() => {
  const tradingAgents = service("trading-agents", {
    builder: "dockerfile",
  });

  return project("brilliant-rejoicing", {
    resources: [tradingAgents],
  });
});
