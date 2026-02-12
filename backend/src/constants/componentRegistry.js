export const ALLOWED_COMPONENTS = [
  "Button",
  "Card",
  "Input",
  "Table",
  "Modal",
  "Sidebar",
  "Navbar",
  "Chart"
];

export const DEFAULT_TREE = {
  id: "page_root",
  type: "page",
  className: "generated-page",
  children: [
    {
      id: "navbar_main",
      type: "Navbar",
      props: {
        title: "Generated Workspace",
        links: ["Overview", "Analytics", "Settings"]
      }
    },
    {
      id: "layout_main",
      type: "layout",
      className: "generated-main",
      children: [
        {
          id: "sidebar_main",
          type: "Sidebar",
          props: {
            title: "Menu",
            items: ["Dashboard", "Reports", "Team", "Billing"]
          }
        },
        {
          id: "content_main",
          type: "layout",
          className: "generated-content",
          children: [
            {
              id: "card_welcome",
              type: "Card",
              props: {
                title: "Welcome",
                body: "Describe your UI in the chat to iterate this screen.",
                footer: "Deterministic components only"
              }
            }
          ]
        }
      ]
    }
  ]
};
