import "dotenv/config";
import { App, StackProps } from "aws-cdk-lib";
import { join } from "path";
import { getSubfolders } from "./util";
import { LambdaStack } from "./lambda";

const { version: APP_VERSION } = require("../../package.json");
const { AWS_ACCOUNT, AWS_REGION, APP, STAGE } = process.env;

const SRC_ROOT = join(__dirname, "../");

async function main() {
  console.log("### CDK:init", {
    APP,
    APP_VERSION,
    AWS_ACCOUNT,
    AWS_REGION,
    STAGE,
  });

  const scope = new App({});
  const props: StackProps = {
    env: {
      account: AWS_ACCOUNT,
      region: AWS_REGION,
    },
    tags: {
      app: APP,
      stage: STAGE,
    },
    description: "Developed by juca.dev",
  };

  const apiSrc = join(SRC_ROOT, "api");
  for (const key of getSubfolders(apiSrc)) {
    console.log("### CDK:API", { key });
    const lambda = new LambdaStack(scope, `${APP}-api-${key}`, {
      ...props,
      source: join(apiSrc, key),
      alias: STAGE,
      version: APP_VERSION,
    });
  }
}

main();
