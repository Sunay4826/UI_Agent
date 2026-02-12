export const defaultCode = `function renderGeneratedUI(React, components) {
  const { Button, Card, Input, Table, Modal, Sidebar, Navbar, Chart } = components;
  return React.createElement(
    "div",
    { className: "generated-page" },
    React.createElement(Navbar, {
      title: "Product Command Center",
      links: ["Overview", "Signals", "Settings"]
    }),
    React.createElement(
      "div",
      { className: "generated-main" },
      React.createElement(Sidebar, {
        title: "Workspace",
        items: ["Dashboard", "Experiments", "Releases", "Billing"]
      }),
      React.createElement(
        "div",
        { className: "generated-content" },
        React.createElement(Card, {
          title: "Welcome",
          body: "Use /chat route to generate and iterate your UI. Open /agent route to inspect planner output.",
          footer: "Deterministic component system"
        }),
        React.createElement(Input, {
          label: "Search Projects",
          placeholder: "Try typing here...",
          value: ""
        }),
        React.createElement(Table, {
          columns: ["Project", "Status", "Owner"],
          rows: [
            ["Atlas", "Active", "Ava"],
            ["Zenith", "Review", "Noah"],
            ["Nova", "Blocked", "Mia"]
          ]
        }),
        React.createElement(Chart, {
          title: "Weekly Throughput",
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
          points: [9, 14, 11, 18, 15, 22]
        }),
        React.createElement(Button, {
          label: "Primary Action",
          variant: "primary"
        }),
        React.createElement(Modal, {
          title: "Settings",
          body: "This modal is interactive in preview: confirm and close actions work.",
          open: true,
          confirmLabel: "Apply"
        })
      )
    )
  );
}`;
