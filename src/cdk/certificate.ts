import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

interface Props extends StackProps {
  domain: string;
}

export class CertificateStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, `${id}-certificate`, props);

    const { domain } = props;

    const parameterName = `/${id}/cert/${domain}`;

    const hostedZone = HostedZone.fromLookup(this, `hostedZone`, {
      domainName: domain,
    });

    const cert = new Certificate(this, "certificate", {
      domainName: domain,
      subjectAlternativeNames: [domain, `*.${domain}`],
      validation: CertificateValidation.fromDns(hostedZone),
    });

    new StringParameter(this, "param-arn", {
      parameterName,
      stringValue: cert.certificateArn,
    });

    new CfnOutput(this, "arn", { value: cert.certificateArn });
  }
}
