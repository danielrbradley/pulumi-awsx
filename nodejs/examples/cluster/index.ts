// Copyright 2016-2018, Pulumi Corporation.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";

const prefix = "infratest";
const numberOfAvailabilityZones = 2;
const instanceType = "t2.small";

const config = new pulumi.Config("aws");
const providerOpts = { provider: new aws.Provider("prov", { region: <aws.Region>config.require("envRegion") }) };

const vpc = new awsx.ec2.Vpc(`${prefix}-net`, { numberOfAvailabilityZones }, providerOpts);
const cluster = new awsx.ecs.Cluster(prefix, { vpc }, providerOpts);

cluster.createAutoScalingGroup(prefix, {
    subnetIds: vpc.publicSubnetIds,
    templateParameters: {
        minSize: 10,
    },
    launchConfigurationArgs: {
        instanceType,
        associatePublicIpAddress: true,
    },
})

// Export details of the network and cluster
export let vpcId: pulumi.Output<string> = vpc.vpc.id;
export let privateSubnetIds = pulumi.all(vpc.privateSubnetIds).apply(ids => ids.join(","));
export let publicSubnetIds = pulumi.all(vpc.publicSubnetIds).apply(ids => ids.join(","));
export let securityGroupIds = pulumi.all(cluster.securityGroups.map(g => g.id)).apply(ids => ids.join(","));
export let ecsClusterARN: pulumi.Output<string> = cluster.cluster.arn;
