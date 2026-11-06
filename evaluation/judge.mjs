// Offline process only; not imported or bundled by the application.
import { generateResponse } from '@lovable.dev/ai-gateway';

const prompt = await Bun.stdin.text();
try {
  const response = await generateResponse({ model: 'openai/gpt-6-astra', input: prompt }, { maxRetries: 0 });
  if (response.status !== 'completed') throw new Error('Incomplete response');
  const text = response.output.filter((item) => item.type === 'message')
    .flatMap((item) => item.content).filter((part) => part.type === 'output_text')
    .map((part) => part.text).join('\n');
  if (!text) throw new Error('Empty response');
  process.stdout.write(text);
} catch {
  process.stderr.write('Evaluation judge failed; check AI Gateway request logs.\n');
  process.exitCode = 1;
}