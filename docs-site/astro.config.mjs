import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://sabajamalian.github.io",
  base: "/enterprise-innovation-hub-demo-kit",
  integrations: [
    starlight({
      title: "Enterprise Innovation Hub",
      description: "A field guide for demonstrating governed employee innovation.",
      customCss: ["./src/styles/amber-terminal.css"],
      social: {
        github: "https://github.com/sabajamalian/enterprise-innovation-hub-demo-kit"
      },
      sidebar: [
        { label: "Field guide", items: [
          { label: "Start here", slug: "index" },
          { label: "Architecture", slug: "architecture" },
          { label: "Prepare the customer", slug: "preparation" },
          { label: "Deploy with azd", slug: "deployment" },
          { label: "Run the retail demo", slug: "demo" },
          { label: "Governance controls", slug: "governance" },
          { label: "Reset and troubleshoot", slug: "operations" }
        ]}
      ]
    })
  ]
});
