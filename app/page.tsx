import { VoiceCall } from "@/components/voice-call";

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">VOLA-lite — Fish Audio POC</h1>
        <p className="text-muted-foreground">
          A thin vertical slice proving the core replacement loop: create + publish
          an agent, hold a live browser voice conversation, then review the
          transcript, recording, and auto-generated post-call analysis.
        </p>
      </div>
      <VoiceCall />
    </div>
  );
}
