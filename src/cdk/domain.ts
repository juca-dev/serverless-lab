import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
import { Route53 } from "@aws-sdk/client-route-53";

interface Props extends StackProps {
  domain: string;
  hostedZoneId?: string;
}

export class DomainStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, `${id}-domain`, props);

    const { domain, hostedZoneId } = props;

    const hostedZone = hostedZoneId
      ? HostedZone.fromHostedZoneId(this, "hostedZone", hostedZoneId)
      : new HostedZone(this, "hostedZone", { zoneName: domain });

    new CfnOutput(this, "arn", { value: hostedZone.hostedZoneArn });
  }

  static async getId(domain: string) {
    const route53 = new Route53();
    const res = await route53.listHostedZonesByName({
      DNSName: domain,
    });
    if (!res.HostedZones || res.HostedZones.length === 0) {
      console.log(`###Route53 - "${domain}" required`);
      return undefined;
    }

    console.log(`###Route53 - domain "${domain}" already created`);
    return res.HostedZones.at(0).Id;
  }
}
