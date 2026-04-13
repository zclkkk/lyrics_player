import './styles/main.css';
import { createState, createElements, createApp } from './app';

const state = createState();
const elements = createElements();
const app = createApp(state, elements);
app.init();
