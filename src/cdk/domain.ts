import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import {
  HostedZone,
} from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";

interface Props extends StackProps {
  domain: string;
}

export class DomainStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, `${id}-domain`, props);

    const { domain } = props;

    const hostedZone = new HostedZone(this, "Zone", { zoneName: domain });

    new CfnOutput(this, "arn", { value: hostedZone.hostedZoneArn });
  }
}
