# ASI Voice Clone Studio

Open-source, self-hostable speech-to-speech voice conversion using [Resemble AI ChatterboxVC](https://github.com/resemble-ai/chatterbox).

**Hosted frontend:** https://asi-voice-clone-studio-l764oy.v2.appdeploy.ai/

> **Project status:** The AppDeploy interface is deployed. GPU inference is **not yet connected or validated end-to-end on real NVIDIA hardware**. Do not describe this repository as a fully operational hosted voice-cloning API until real conversion, quality, error handling, privacy, and export tests pass.

## Repository layout

- `appdeploy/` — the current hosted React/TypeScript interface and AppDeploy backend source snapshot.
- `gpu-engine/` — authenticated FastAPI GPU service, Docker / RunPod deployment, processing queue, persistence, tests, and CLI smoke test.
- `local-mvp/` — original self-hostable FastAPI application.
- `notebooks/` — Kaggle GPU notebook for interactive tests.

## Architecture

1. Sign into the AppDeploy UI as the authorized owner.
2. Upload source narration and a voice recording belonging to you or a speaker who has explicitly authorized the use.
3. AppDeploy securely proxies the audio to `gpu-engine/`.
4. The GPU worker uses ChatterboxVC and returns processed speech with MP3/WAV export.

**No paid voice-cloning API** is required. Running a GPU, however, has hardware/electricity or cloud-hosting costs. Kaggle GPU notebooks are not suitable for permanent API hosting.

## Connecting a GPU server

1. See [gpu-engine/README.md](gpu-engine/README.md) and [gpu-engine/RUNPOD-SETUP.md](gpu-engine/RUNPOD-SETUP.md).
2. Deploy `gpu-engine/` to an NVIDIA GPU host with HTTPS and a strong random bearer token.
3. In the **existing** AppDeploy app, securely configure `VOICE_ENGINE_URL` and `VOICE_ENGINE_TOKEN` using its secrets controls. The URL must match your HTTPS engine; the token must match the worker's environment.
4. Confirm authenticated `GET /api/health`, then run an authorized input-to-output test including both WAV and MP3.

Never commit `.env`, credentials, private recordings, output audio, or downloaded model weights.

## Testing and licensing

Local automated tests primarily exercise the service with a simulated model; **real CUDA inference is unverified**. The upstream Chatterbox project is MIT licensed. Check dependency and model licenses before commercial use. Preserve any built-in watermarking and obtain explicit speaker permission.
