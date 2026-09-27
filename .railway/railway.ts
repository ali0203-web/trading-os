import { defineRailway, project, service, database } from "railway/iac";

export default defineRailway(() => {
  const tradingAgents = service("fabulous-energy", {
    builder: "dockerfile",
    dockerfile: "./Dockerfile",
  });

  return project("bountiful-miracle", {
    resources: [tradingAgents],
  });
});
