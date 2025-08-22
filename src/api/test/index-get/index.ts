export const handler = async (ev: any) => {
  const data = {
    text: `Hello from /test/index GET!`,
  };

  const res = {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };

  return res;
};
