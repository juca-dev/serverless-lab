import { Stack, StackProps } from "aws-cdk-lib";
import {
  ApiMapping,
  DomainName,
  HttpApi,
  HttpStage,
} from "aws-cdk-lib/aws-apigatewayv2";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { ApiGatewayv2DomainProperties } from "aws-cdk-lib/aws-route53-targets";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

interface Props extends StackProps {
  domain: string;
  stage: string;
  httpApis: HttpApi[];
}

export class ApiDomainStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    const { domain: apiDomain, stage, httpApis } = props;

    super(scope, `${id}-apigw-domain-${stage}`, props);

    const domain = this.toRootDomain(apiDomain);
    const certArn = StringParameter.fromStringParameterName(
      this,
      "certArn",
      `/${id}/cert/${domain}`
    );
    if (!certArn) {
      throw new Error(`Required stringParameter "/${id}/cert/${domain}"!`);
    }
    const cert = Certificate.fromCertificateArn(
      this,
      `certificate`,
      certArn.stringValue
    );

    const domainName = new DomainName(this, `domainName`, {
      domainName: apiDomain,
      certificate: cert,
    });

    httpApis.forEach((e) => {
      new ApiMapping(this, `path-${e.httpApiName}`, {
        apiMappingKey: e.httpApiName!.replace(`${id}-api-`, ""), // TODO: managed by api name
        domainName,
        api: e,
        stage: HttpStage.fromHttpStageAttributes(this, `stage-${e.httpApiName}`, {
          api: e,
          stageName: stage,
        }),
      });
    });

    const hostedZone = HostedZone.fromLookup(this, "hostedZone", {
      domainName: domain,
    });
    new ARecord(this, "aliasRecord", {
      recordName: apiDomain,
      zone: hostedZone,
      target: RecordTarget.fromAlias(
        new ApiGatewayv2DomainProperties(
          domainName.regionalDomainName,
          domainName.regionalHostedZoneId
        )
      ),
    });
  }
  private toRootDomain(domain: string): string {
    const parts = domain.split(".");
    if (parts.length <= 2) {
      return "*." + domain;
    }
    // replace subdoman by "*"
    parts.shift();
    return parts.join(".");
  }
}
