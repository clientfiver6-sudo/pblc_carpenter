export async function transcribeAudio(audioUrl: string): Promise<string> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) return ""
  try {
    const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&language=pt-BR&smart_format=true", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: audioUrl }),
    })
    const json = await res.json() as { results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> } }
    return json.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ""
  } catch {
    return ""
  }
}
