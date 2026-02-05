# OmniSense Core

Proactive, privacy-first multimodal "Cognitive Second Brain" for meetings and safety, built for the Gemini 3 Hackathon.

## 🚀 Quick Start Guide

### Step 1: Prerequisites
- **Node.js 18+** installed on your system
- **Google Gemini API key** (get one from [Google AI Studio](https://aistudio.google.com/))

### Step 2: Setup Project
1. Clone or download this project
2. Create a `.env.local` file in the project root
3. Add your API credentials:

```
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.0-pro
```

### Step 3: Run the Application
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open **http://localhost:3000** in your browser

### Step 4: Basic Usage Flow
1. **Home Screen** - Enable mic/cam for real-time meeting assistance
2. **Upload Screen** - Analyze video recordings for insights
3. **Trainer Panel** - Customize AI behavior and preferences
4. **Verification/Audit** - Review session history and generate reports

## 📖 Detailed Features

### Core Screens
- **Home**: Live mic/cam assistance, speaking intensity monitoring, interruption detection, real-time suggestions, and AI trainer panel
- **Upload**: Extract frames from videos and get structured JSON insights with confidence scores
- **Trainer**: Fine-tune AI system instructions, preferences, and conversation history
- **Verification/Audit**: Review session timeline, verify AI actions, and export HTML reports

## 🔧 API Endpoints

### Analysis & Insights
- `POST /api/omnisense/analyze` - Get real-time AI insights from live context
- `POST /api/omnisense/analyze-frames` - Analyze video frames with transcript
- `GET /api/omnisense/analyze/stream` - Streaming insights demo

### Configuration & Management
- `GET/POST /api/omnisense/context` - Manage AI instructions and preferences
- `POST /api/extract-actions` - Convert notes to actionable tasks
- `POST /api/suggest` - Get coaching suggestions from audio patterns

### Testing & Development
- `GET /api/evaluate` - Test AI with synthetic scenarios
- `GET /api/local-video` - Development video streaming
- `GET /api/health` - System health check

## 🎯 How It Works

### User Workflow
1. **Start Session** - Enable microphone/camera on Home screen
2. **Real-time Analysis** - AI provides live coaching and insights
3. **Video Upload** - Analyze recorded meetings for detailed insights
4. **Customize AI** - Use Trainer to adjust AI behavior
5. **Review Results** - Check verification panel for session summary

### AI Process Flow
```
User Input (Audio/Video) 
    ↓
Feature Detection (Speaking patterns, interruptions)
    ↓
AI Analysis (Gemini 3 reasoning)
    ↓
Actionable Insights + Confidence Score
    ↓
User Feedback & Verification
```

## 🛡️ Privacy & Security

### Privacy Modes
- **Cloud Mode**: Full AI features with cloud processing
- **Local Mode**: Basic features without external API calls
- **Off Mode**: Analysis disabled, maximum privacy

### Data Protection
- No raw audio/video files stored permanently
- Only brief context and settings saved locally in `.data/omni.json`
- AI instructed to avoid sensitive personal information
- Rate limiting on analysis endpoints

## 🚀 Deployment

### Production Build
```bash
npm run build
npm run start
```

### Vercel (Recommended)
1. Connect repository to Vercel
2. Set environment variables: `GEMINI_API_KEY`, `GEMINI_MODEL`
3. Deploy and visit your public URL

### Netlify
1. Use included `netlify.toml` configuration
2. Set same environment variables
3. Deploy with Next.js plugin

## 🔍 Optional Features

### Research Provider (Web Enrichment)
- **Endpoint**: `GET /api/research?name=Full%20Name`
- **Privacy Mode Behavior**:
  - **Off**: Blocked (403), no web calls
  - **Local**: Returns local message only
  - **Cloud**: Uses Google Search or Wikipedia fallback
- **Setup** (Optional):
  ```
  GOOGLE_API_KEY=your_google_api_key
  GOOGLE_CSE_ID=your_custom_search_engine_id
  ```

### AI Glasses Integration (Hybrid Mode)
- Toggle "Connect Glasses" button in header
- **Simulated Mode**: Demo with head motion, brightness, temperature data
- **Real SDK**: Placeholder for vendor-specific integration
- Enhanced suggestions with sensor data context

## 🧪 Testing & Quality Assurance

### Quick Demo Path
1. Visit `/upload` → Click "Load default" → Analyze
2. Paste notes in Home screen → Extract Actions
3. Open Trainer → Edit instructions → Test with `/api/evaluate`

### Evaluation System
- Built-in synthetic scenarios for testing
- Confidence scoring for AI responses
- Iterative prompt improvement through Trainer panel

## 🐛 Troubleshooting

### Common Issues
- **API Key Problems**: Ensure `GEMINI_API_KEY` is valid and in `.env.local`
- **Network Issues**: Check firewall allows HTTPS to Google APIs
- **Privacy Mode**: Cloud mode required for full features
- **Demo Mode**: Works without keys but with limited functionality

### Health Checks
```bash
# Test API health
curl http://localhost:3000/api/health

# Test evaluation system
curl http://localhost:3000/api/evaluate
```

## 📋 Judge Demo Checklist

### Quick Demo (3-5 minutes)
1. **Upload Demo**: Load default video → Analyze → Review insights
2. **Action Extraction**: Paste meeting notes → Generate action items
3. **Live Features**: Enable mic/cam → Test real-time coaching
4. **Verification**: Review session timeline → Export HTML report

### Production Features
- Autonomous agent runs with goal completion
- Temporal reasoning and real-time coaching
- Long-context continuity across sessions
- Verification artifacts and audit trails

## 🏗️ Architecture Overview

```
Browser (Next.js App)
├─ Live mic/cam + temporal detectors
├─ Conversational Voice + TTS
├─ Panels: Detections • Autonomous Run • Verification
└─ API calls to /api/agent/* and /api/audit/*

Server (Next API Routes)
├─ Agent Orchestrator
│   ├─ Long-context assembly (session + logs + tasks)
│   ├─ Gemini 3 Pro calls → structured tool execution
│   ├─ Verification system (JSONL + timeline)
│   └─ Tools: tasks, calendar, memory, notes, web search
├─ Audit/Report generation
└─ Local storage in .data/ directory

Gemini 3 Pro (Google AI)
└─ Multimodal reasoning with structured outputs
```

## 📄 License

MIT License - See `LICENSE` file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Test with evaluation system
4. Submit pull request

---

**For detailed demo scripts and technical specifications, see `SUBMISSION.md`**

