import "./styles/main.css";
import { createApp, createElements, createState } from "./app";

const state = createState();
const elements = createElements();
const app = createApp(state, elements);
app.init();
