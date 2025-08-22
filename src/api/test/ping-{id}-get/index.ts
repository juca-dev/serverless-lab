export const handler = async (ev: any) => {
  const { id } = ev.pathParameters;
  const data = {
    text: `Hi ${id}, this is a test!`
  };

  const res = {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };

  return res;
};
