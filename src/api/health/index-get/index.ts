export const handler = async (ev: any) => {
  const data = {
    now: new Date().toISOString(),
  };

  const res = {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };

  return res;
};
