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
import { EventRuleEvent } from "@pulumi/aws/cloudwatch";
import * as pulumi from "@pulumi/pulumi";

export type BuildStatus =
    | "FAILED"
    | "FAULT"
    | "IN_PROGRESS"
    | "STOPPED"
    | "SUCCEEDED"
    | "TIMED_OUT";

export type PhaseStatus =
    | "FAILED" // The build phase failed.
    | "FAULT" // The build phase faulted.
    | "IN_PROGRESS" // The build phase is still in progress.
    | "QUEUED" // The build has been submitted and is queued behind other submitted builds.
    | "STOPPED" // The build phase stopped.
    | "SUCCEEDED" // The build phase succeeded.
    | "TIMED_OUT"; // The build phase timed out.

type NonCompletedPhaseType =
    | "SUBMITTED"
    | "PROVISIONING"
    | "DOWNLOAD_SOURCE"
    | "INSTALL"
    | "PRE_BUILD"
    | "BUILD"
    | "POST_BUILD"
    | "UPLOAD_ARTIFACTS"
    | "FINALIZING";

type NonCompletedPhase = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "phase-context": any[];
    /** e.g. 'Sep 1, 2017 4:12:29 PM' */
    "start-time"?: string;
    /** e.g. 'Sep 1, 2017 4:12:29 PM' */
    "end-time"?: string;
    "duration-in-seconds"?: number;
    "phase-type": NonCompletedPhaseType;
    "phase-status": PhaseStatus;
};

type CompletedPhase = {
    /** e.g. 'Sep 1, 2017 4:12:29 PM' */
    "start-time"?: string;
    "phase-type": "COMPLETED";
};

export type ComputeType =
    | "BUILD_GENERAL1_SMALL"
    | "BUILD_GENERAL1_MEDIUM"
    | "BUILD_GENERAL1_LARGE";

export type Phase = NonCompletedPhase | CompletedPhase;

export type PhaseType = Phase["phase-type"];

export type CodeBuildStateChangeDetail = {
    "build-status": BuildStatus;
    /** e.g. 'my-sample-project' */
    "project-name": string;
    /** e.g. 'arn:aws:codebuild:us-west-2:123456789012:build/my-sample-project:8745a7a9-c340-456a-9166-edf953571bEX' */
    "build-id": string;
    "additional-information": {
        artifact?: {
            md5sum: string;
            sha256sum: string;
            location: string;
        };
        environment: {
            image?: string;
            "privileged-mode"?: boolean;
            "compute-type"?: string;
            type?: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            "environment-variables"?: any[];
        };
        "timeout-in-minutes": number;
        "build-complete": boolean;
        initiator?: string;
        /** E.g. 'Sep 1, 2017 4:12:29 PM' */
        "build-start-time": string;
        source?: {
            /** e.g. 'codebuild-123456789012-input-bucket/my-input-artifact.zip' */
            location?: string;
            type?: string;
        };
        logs?: {
            /** e.g. '/aws/codebuild/my-sample-project' */
            "group-name": string;
            /** e.g. '8745a7a9-c340-456a-9166-edf953571bEX' */
            "stream-name": string;
            /** 'https://console.aws.amazon.com/cloudwatch/home?region=us-west-2#logEvent:group=/aws/codebuild/my-sample-project;stream=8745a7a9-c340-456a-9166-edf953571bEX' */
            "deep-link": string;
        };
        phases: Phase[];
    };
    "current-phase": PhaseType;
    "current-phase-context": string;
    version: string;
};

export namespace automation {
    // Type Lanuage Meanings
    // "Project" refers to a GitHub project.
    // "Build" refers to a CodeBuild project.

    export type SubscriptionOptions<TSubscriptionConfig> = {
        status: BuildStatus[];
        config: TSubscriptionConfig;
    };

    export type ProjectBuildSubscriptionOptions<TSubscriptionConfig> = {
        status?: BuildStatus[];
        config?: TSubscriptionConfig;
    };

    export type BuildTypeSubscriptionOptions<TSubscriptionConfig> = {
        status: BuildStatus[];
        config?: TSubscriptionConfig;
    };

    export type StaticNameBuildArgs = aws.codebuild.ProjectArgs & {
        name: string;
    };

    export type BuildConfiguration = {
        build: StaticNameBuildArgs;
        webhookFilterGroups?: pulumi.Input<
            pulumi.Input<aws.types.input.codebuild.WebhookFilterGroup>[]
        >;
    };

    export type BuildConfigurations = {
        [buildType: string]: BuildConfiguration;
    };

    export type ProjectBuildSubscriptions<
        TBuildConfigurations extends BuildConfigurations,
        TSubscriptionConfig
    > = {
        [P in keyof TBuildConfigurations]: ProjectBuildSubscriptionOptions<
            TSubscriptionConfig
        >;
    };

    export type BuildTypeSubscriptions<
        TBuildConfigurations extends BuildConfigurations,
        TSubscriptionConfig
    > = {
        [P in keyof TBuildConfigurations]: BuildTypeSubscriptionOptions<
            TSubscriptionConfig
        >;
    };

    export type ProjectArgs<
        TBuildConfigurations extends BuildConfigurations,
        TSubscriptionConfig
    > = {
        /**
         * Name of the project - used to derive the build configuration names.
         */
        name: string;
        /**
         * When to send alerts for build results
         */
        subscriptions?: Partial<
            ProjectBuildSubscriptions<TBuildConfigurations, TSubscriptionConfig>
        >;
    };

    export type BuildSetupStrategy<TProjectArgs extends ProjectArgs<TBuildConfigurations, TSubscriptionConfig>, TBuildConfigurations extends BuildConfigurations, TSubscriptionConfig = {}> = (
        projectArgs: TProjectArgs,
    ) => TBuildConfigurations;

    export type SubscriptionEvent = {
        eventRuleEvent: EventRuleEvent;
        detail: CodeBuildStateChangeDetail;
    };

    export type SubscriptionCallback<TSubscriptionConfig> = (
        event: SubscriptionEvent,
        options: SubscriptionOptions<TSubscriptionConfig>,
    ) => Promise<void> | void;

    export type BuildSubscriptionsArgs<
        TBuildConfig extends BuildConfigurations,
        TSubscriptionConfig
    > = {
        callback: SubscriptionCallback<TSubscriptionConfig>;
        config: TSubscriptionConfig;
        buildType: BuildTypeSubscriptions<TBuildConfig, TSubscriptionConfig>;
    };

    export type ConfigureBuildsArgs<
        TProjectArgs extends ProjectArgs<TBuildConfigurations, TSubscriptionConfig>,
        TBuildConfigurations extends BuildConfigurations,
        TSubscriptionConfig = {}
    > = {
        buildSetup: BuildSetupStrategy<TProjectArgs, TBuildConfigurations, TSubscriptionConfig>;
        subscriptions?: BuildSubscriptionsArgs<
            TBuildConfigurations,
            TSubscriptionConfig
        >;
        projectDefaults: Partial<TProjectArgs>;
        projects: TProjectArgs[];
    };

    export class AutomationServer<
    TProjectArgs extends ProjectArgs<TBuildConfigurations, TSubscriptionConfig>,
    TBuildConfigurations extends BuildConfigurations,
        TSubscriptionConfig = {}
    > extends pulumi.ComponentResource {
        projects: aws.codebuild.Project[];
        webhooks: aws.codebuild.Webhook[];
        subscriptionRole?: aws.iam.Role;
        subscriptionRolePolicyAttachment?: aws.iam.RolePolicyAttachment;
        subscriptionRolePolicy?: aws.iam.RolePolicy;
        subscriptionLambdaFunction?: aws.lambda.CallbackFunction<
            aws.cloudwatch.EventRuleEvent,
            void
        >;
        eventRules: aws.cloudwatch.EventRule[] = [];
        eventRuleEventSubscriptions: aws.cloudwatch.EventRuleEventSubscription[] = [];
        /**
         *
         */
        constructor(
            name: string,
            {
                buildSetup,
                subscriptions,
                projectDefaults,
                projects,
            }: ConfigureBuildsArgs<TProjectArgs, TBuildConfigurations, TSubscriptionConfig>,
            opts: pulumi.ComponentResourceOptions = {},
        ) {
            super("awsx:x:codebuild:AutomationServer", name, {}, opts);

            const projectsWithSetups = projects.map(project => ({
                project,
                subscriptions: subscriptions
                    ? {
                          ...subscriptions.buildType,
                          ...project.subscriptions,
                      }
                    : undefined,
                buildSetups: buildSetup({ ...projectDefaults, ...project }),
            }));
            this.projects = [];
            this.webhooks = [];
            for (const projectSetups of projectsWithSetups) {
                for (const key of Object.keys(projectSetups.buildSetups)) {
                    const buildSetup = projectSetups.buildSetups[key];
                    const codebuildProject = new aws.codebuild.Project(
                        buildSetup.build.name,
                        buildSetup.build,
                        { parent: this },
                    );
                    this.projects.push(codebuildProject);
                    if (buildSetup.webhookFilterGroups !== undefined) {
                        const webhook = new aws.codebuild.Webhook(
                            `${buildSetup.build.name}-webhook`,
                            {
                                projectName: codebuildProject.name,
                                filterGroups: buildSetup.webhookFilterGroups,
                            },
                            { parent: this },
                        );
                        this.webhooks.push(webhook);
                    }
                }
            }

            if (subscriptions) {
                const projectSuscriptions = Array.from(
                    (function* failedBuildAlertProject() {
                        for (const project of projectsWithSetups) {
                            if (!project.subscriptions) {
                                continue;
                            }
                            for (const buildType of Object.keys(
                                project.buildSetups,
                            )) {
                                const status =
                                    project.subscriptions[buildType].status ||
                                    subscriptions.buildType[buildType].status;
                                if (status.length > 0) {
                                    yield {
                                        name:
                                            project.buildSetups[buildType].build
                                                .name,
                                        buildType: buildType,
                                        buildStatus: status,
                                        options:
                                            project.subscriptions[buildType],
                                    };
                                }
                            }
                        }
                    })(),
                );

                const groupedProjectSubscription = new Map<
                    string,
                    typeof projectSuscriptions
                >();
                for (const project of projectSuscriptions) {
                    const key = project.buildStatus.sort().join();
                    const group = groupedProjectSubscription.get(key);
                    if (group === undefined) {
                        groupedProjectSubscription.set(key, [project]);
                    } else {
                        group.push(project);
                    }
                }

                const projectRules = Array.from(
                    (function*() {
                        for (const projects of groupedProjectSubscription.values()) {
                            const buildStatus = projects[0].buildStatus;
                            yield {
                                projects: projects.map(p => p.name),
                                buildStatus,
                            };
                        }
                    })(),
                );

                this.subscriptionRole = new aws.iam.Role(
                    `${name}-subscription-role`,
                    {
                        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
                            Service: "lambda.amazonaws.com",
                        }),
                    },
                    { parent: this },
                );

                this.subscriptionRolePolicyAttachment = new aws.iam.RolePolicyAttachment(
                    `${name}-subscription-role-policy-attachment`,
                    {
                        policyArn:
                            "arn:aws:iam::aws:policy/AWSLambdaFullAccess",
                        role: this.subscriptionRole,
                    },
                    { parent: this },
                );

                this.subscriptionRolePolicy = new aws.iam.RolePolicy(
                    `${name}-subscription-role-policy`,
                    {
                        role: this.subscriptionRole,
                        policy: pulumi.output({
                            Version: "2012-10-17",
                            Statement: [
                                {
                                    Action: [
                                        "codebuild:ListBuildsForProject",
                                        "codebuild:BatchGetBuilds",
                                    ],
                                    Resource: "*",
                                    Effect: "Allow",
                                },
                            ],
                        }),
                    },
                    { parent: this },
                );

                this.subscriptionLambdaFunction = new aws.lambda.CallbackFunction<
                    aws.cloudwatch.EventRuleEvent,
                    void
                >(
                    `${name}-subscription-lambda-function`,
                    {
                        role: this.subscriptionRole,
                        callback: async e => {
                            const detail = e.detail as CodeBuildStateChangeDetail;
                            const project = projectSuscriptions.find(
                                project =>
                                    project.name === detail["project-name"],
                            );
                            if (!project) {
                                throw new Error("Project options not found");
                            }
                            const options = {
                                config: subscriptions.config,
                                status:
                                    subscriptions.buildType[project.buildType]
                                        .status,
                                ...project.options,
                            };
                            const result = subscriptions.callback(
                                {
                                    eventRuleEvent: e,
                                    detail: detail,
                                },
                                options,
                            );
                            if (result !== undefined) {
                                await result;
                            }
                        },
                    },
                    { parent: this },
                );

                for (const projectRule of projectRules) {
                    const index = projectRules.indexOf(projectRule);
                    const eventRule = new aws.cloudwatch.EventRule(
                        `${name}-event-rule-${index}`,
                        {
                            eventPattern: JSON.stringify({
                                source: ["aws.codebuild"],
                                "detail-type": ["CodeBuild Build State Change"],
                                detail: {
                                    "build-status": projectRule.buildStatus,
                                    "project-name": projectRule.projects,
                                },
                            }),
                        },
                        { parent: this },
                    );
                    this.eventRules.push(eventRule);

                    const eventRuleEventSubscription = new aws.cloudwatch.EventRuleEventSubscription(
                        `${name}-event-rule-event-subscription-${index}`,
                        eventRule,
                        this.subscriptionLambdaFunction,
                        { parent: this },
                    );
                    this.eventRuleEventSubscriptions.push(
                        eventRuleEventSubscription,
                    );
                }
            }

            this.registerOutputs({
                eventRuleEventSubscriptions: this.eventRuleEventSubscriptions,
                eventRules: this.eventRules,
                projects: this.projects,
                subscriptionLambdaFunction: this.subscriptionLambdaFunction,
                subscriptionRole: this.subscriptionRole,
                subscriptionRolePolicy: this.subscriptionRolePolicy,
                subscriptionRolePolicyAttachment: this.subscriptionRolePolicyAttachment,
                webhooks: this.webhooks,
            });
        }
    }
}
