# OmniSense Core Privacy

- No raw audio/video is persisted by the app. Media is only processed in-memory in the browser for frame extraction and audio level analysis.
- API requests send minimal data: structured observations (audio intensity booleans/percentages), short transcript snippets, and a capped set of image frames (client-selected) for explicit analysis.
- System context (system instruction, preferences, history snippet) is stored locally in `.data/omni.json` on the server for development use.
- The app avoids inferring or stating sensitive attributes (e.g., identity, protected classes). Prompts explicitly prohibit these inferences.
- Configure and rotate your `GEMINI_API_KEY` via environment variables. Do not check secrets into source control.
- For production deployments, place `.data` on encrypted disk or use a managed secret/config store. If persistence is not needed, disable write persistence in `omnisenseStore`.
