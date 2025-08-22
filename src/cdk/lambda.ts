import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { lstatSync, readdirSync } from "fs";
import { join } from "path";
import { getDirectoryHash } from "./util";
import {
  Alias,
  Architecture,
  AssetCode,
  Function,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

interface Props extends StackProps {
  source: string;
  stage: string;
  version?: string;
}

export class LambdaStack extends Stack {
  private readonly id: string;
  private readonly source: string;
  private readonly version: string;
  private readonly stage: string;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, `${id}-lambda`, props);
    this.id = id;
    const { source, stage, version = "0.0.0" } = props;
    this.source = source;
    this.version = version;
    this.stage = stage;

    readdirSync(source)
      .filter(
        (e) =>
          lstatSync(join(source, e)).isDirectory() &&
          lstatSync(join(source, e, "index.js")).isFile()
      )
      .forEach((filePath) => {
        this.build(filePath);
      });
  }

  private build(filePath: string) {
    const source = join(this.source, filePath);
    const name = formatName(filePath);
    console.log("lambda:build", { name, source });
    const description = `v${this.version} (${getDirectoryHash(source)})`;

    const fn = new Function(this, `${name}-fn`, {
      functionName: `${this.id}-${name}`,
      code: new AssetCode(source),
      handler: "index.handler",
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      description,
      retryAttempts: 0,
      currentVersionOptions: {
        removalPolicy: RemovalPolicy.RETAIN, // retain old versions
        retryAttempts: 0, // async retry attempts
        description,
      },
    });
    // Disable logs (Cloud Watch)
    fn.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.DENY,
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: [`arn:aws:logs:${this.region}:${this.account}:*`],
      })
    );

    const version = fn.currentVersion;
    const alias = new Alias(this, `${name}-${this.stage}-alias`, {
      aliasName: this.stage,
      version,
    });
  }
}

function formatName(id: string) {
  let res = id
    .replace(/\//g, "-")
    .split("-")
    .filter((e) => e)
    .join("-"); //remove from start/end

  const params = res.match(/\{([0-9a-z]+)\}/gi); //ex user-{id}-name
  if (params) {
    //ex user-{id}-name => user-ID-name
    for (let param of params) {
      res = res.replace(param, param.replace(/[\{\}]/g, "").toUpperCase());
    }
  }

  return res;
}

export function getFunctionByAlias(stack: Stack, id: string, alias?: string) {
  const name = formatName(id);
  const res = Function.fromFunctionArn(
    stack,
    `fnArn-${name}`, // , `${stack.stackId}-fnArn-${name}`
    `arn:aws:lambda:${stack.region}:${stack.account}:function:${name}${
      alias ? `:${alias}` : ""
    }`
  );
  return res;
}
