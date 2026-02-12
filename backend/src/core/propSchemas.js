export const propSchemas = {
  Button: {
    required: ["label"],
    optional: ["variant"],
    types: {
      label: "string",
      variant: ["primary", "secondary"]
    }
  },
  Card: {
    required: ["title", "body"],
    optional: ["footer"],
    types: {
      title: "string",
      body: "string",
      footer: "string"
    }
  },
  Input: {
    required: ["label", "placeholder"],
    optional: ["value"],
    types: {
      label: "string",
      placeholder: "string",
      value: "string"
    }
  },
  Table: {
    required: ["columns", "rows"],
    optional: [],
    types: {
      columns: "string[]",
      rows: "string[][]"
    }
  },
  Modal: {
    required: ["title", "body"],
    optional: ["open", "confirmLabel"],
    types: {
      title: "string",
      body: "string",
      open: "boolean",
      confirmLabel: "string"
    }
  },
  Sidebar: {
    required: ["title", "items"],
    optional: [],
    types: {
      title: "string",
      items: "string[]"
    }
  },
  Navbar: {
    required: ["title", "links"],
    optional: [],
    types: {
      title: "string",
      links: "string[]"
    }
  },
  Chart: {
    required: ["title", "points", "labels"],
    optional: [],
    types: {
      title: "string",
      points: "number[]",
      labels: "string[]"
    }
  }
};
