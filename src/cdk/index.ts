import "dotenv/config";
import { App, StackProps } from "aws-cdk-lib";
import { join } from "path";
import { getSubfolders } from "./util";
import { LambdaStack } from "./lambda";
import { ApiStack } from "./api";
import { DomainStack } from "./domain";
import { CertificateStack } from "./certificate";
import { ApiDomainStack } from "./apiDomain";
import { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";

const { version: APP_VERSION } = require("../../package.json");
const { AWS_ACCOUNT, AWS_REGION, APP, STAGE, DOMAIN, API_DOMAIN } = process.env;

const SRC_ROOT = join(__dirname, "../..", "dist");

async function main() {
  console.log("### CDK:init", {
    APP,
    APP_VERSION,
    AWS_ACCOUNT,
    AWS_REGION,
    STAGE,
    DOMAIN,
    API_DOMAIN,
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
  const httpApis: Record<string, HttpApi> = {};
  for (const context of getSubfolders(apiSrc)) {
    console.log("CDK:API", { context });
    const lambda = new LambdaStack(scope, `${APP}-api-${context}`, {
      ...props,
      source: join(apiSrc, context),
      stage: STAGE,
      version: APP_VERSION,
    });

    const api = new ApiStack(scope, `${APP}-api-${context}`, {
      ...props,
      source: join(apiSrc, context),
      stage: STAGE,
    });
    httpApis[context] = api.httpApi;
    api.addDependency(lambda);
  }

  const domain = new DomainStack(scope, `${APP}`, {
    ...props,
    domain: DOMAIN,
    hostedZoneId: await DomainStack.getId(DOMAIN),
  });

  const cert = new CertificateStack(scope, `${APP}`, {
    ...props,
    domain: DOMAIN,
  });
  cert.addDependency(domain);

  new ApiDomainStack(scope, `${APP}`, {
    ...props,
    domain: API_DOMAIN,
    stage: STAGE,
    httpApis,
  });
}

main();
