import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";
import { lstatSync, readdirSync } from "fs";
import { join, relative } from "path";
import { getFunctionByAlias } from "./lambda";

interface Props extends StackProps {
  source: string;
  stage: string;
}

export class ApiStack extends Stack {
  private readonly id: string;
  private readonly source: string;
  private readonly stage: string;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, `${id}-apigw`, props);
    this.id = id;
    const { source, stage } = props;
    this.source = source;
    this.stage = stage;

    const routes = this.findHandlers(source);

    const methods = [
      CorsHttpMethod.GET,
      CorsHttpMethod.PUT,
      CorsHttpMethod.POST,
      CorsHttpMethod.DELETE,
      CorsHttpMethod.PATCH,
    ].filter((e) => routes.find((x) => new RegExp(`${e}$`, "i").test(x))); //filter accepted methods
    console.log("api", { id, routes, methods });
    const httpApi = new HttpApi(this, `api`, {
      apiName: `${id}`,
      corsPreflight: {
        //allow access by browser
        allowOrigins: ["*"],
        allowMethods: [...methods, CorsHttpMethod.OPTIONS],
      },
    });

    routes.forEach((route, i) => {
      const paths = route.split("-").filter((e) => e !== "index"); //remove index to be the root
      const method = paths.pop()?.toUpperCase() as HttpMethod;
      const path = paths.join("/");
      console.log("route", { path, method });

      const fn = getFunctionByAlias(this, `${id}-${route}`, props.stage);
      httpApi.addRoutes({
        path: `/${path}`,
        methods: [method],
        integration: new HttpLambdaIntegration(`fn-${i}`, fn),
      });
    });

    const stageApi = httpApi.addStage(`${stage}-stage`, {
      stageName: stage,
      autoDeploy: true,
    });

    new CfnOutput(this, `${stage}-url`, {
      value: stageApi.url,
    });
  }

  private findHandlers(dir: string, root?: string): string[] {
    const entries = readdirSync(dir);
    const keys: string[] = [];

    for (const entry of entries) {
      const fullPath = join(dir, entry);

      if (lstatSync(fullPath).isDirectory()) {
        const indexFile = join(fullPath, "index.js");

        if (
          lstatSync(indexFile, { throwIfNoEntry: false })?.isFile() &&
          /-(GET|POST|PUT|PATCH|DELETE)$/i.test(entry)
        ) {
          // Save relative to base folder
          keys.push(relative(root ?? dir, fullPath));
        }

        // Recurse into subdirectories
        keys.push(...this.findHandlers(fullPath, dir));
      }
    }

    return keys;
  }
}
