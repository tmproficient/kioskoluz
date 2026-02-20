export function ok(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function fail(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Error inesperado";
  return Response.json({ error: message }, { status });
}