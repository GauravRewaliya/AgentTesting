import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "./styles.css";
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";

createApp(App).use(router).mount("#app");
