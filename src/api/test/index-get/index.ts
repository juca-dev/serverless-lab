export const handler = async (ev: any) => {
  const data = {
    text: `Hi, this is a test!`,
  };

  const res = {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };

  return res;
};
