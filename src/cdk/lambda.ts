import { CfnOutput, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { lstatSync, readdirSync } from "fs";
import { join } from "path";
import { getDirectoryHash } from "./util";
import {
  Alias,
  Architecture,
  AssetCode,
  Function,
  FunctionUrlAuthType,
  HttpMethod,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

interface IProps extends StackProps {
  source: string;
  alias?: string;
  version?: string;
}

export class LambdaStack extends Stack {
  private readonly id: string;
  private readonly source: string;
  private readonly version: string;
  private readonly alias: string;
  constructor(scope: Construct, id: string, props: IProps) {
    super(scope, `${id}-lambda`, props);

    this.id = id;
    const { source, version = "0.0.0", alias = "dev" } = props;
    this.source = source;
    this.version = version;
    this.alias = alias;

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

  private formatName(id: string) {
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

  private build(filePath: string) {
    const source = join(this.source, filePath);
    const name = this.formatName(filePath);
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
    const alias = new Alias(this, `${name}-${this.alias}-alias`, {
      aliasName: this.alias,
      version,
    });

    // PUBLIC URL (no auth)
    // TODO: remove it, change to ApiGW
    const publicUrl = alias.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [HttpMethod.GET],
        allowedHeaders: ["*"],
      },
    });

    new CfnOutput(this, `${name}-${this.alias}-url`, {
      value: publicUrl.url,
    });
  }
}
