export async function register() {
  console.log('[instrumentation] register() started');
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    console.log('[instrumentation] skipping non-nodejs runtime');
    return;
  }

  console.log('[instrumentation] loading instrumentation.node.ts');
  const { registerNodeInstrumentation } =
    await import('./instrumentation.node');
  console.log('[instrumentation] calling registerNodeInstrumentation()');
  registerNodeInstrumentation();
  console.log('[instrumentation] registerNodeInstrumentation() finished');
}
