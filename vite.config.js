import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig(({ command }) => ({
  // In production (GitHub Pages) the app is served under /<repo-name>/.
  // Change this to match your GitHub repository name, or set to "/" if using a
  // custom domain or a user/org pages site (username.github.io).
  base: command === "build" ? "/3d_vision/" : "/",

  plugins: command === "serve" ? [basicSsl()] : [],

  server: {
    https: true,
    // Expose on local network so mobile devices can connect
    host: true,
  },
}));
