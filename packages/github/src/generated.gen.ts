// @ts-nocheck
// GENERATED FILE — do not edit. See codegen.yml.

class TypedDocumentString<TResult, TVariables> extends String {
    __apiType?: (variables: TVariables) => TResult;
}
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** The possible states for a check suite or run conclusion. */
export type CheckConclusionState =
    /** The check suite or run requires action. */
    | 'ACTION_REQUIRED'
    /** The check suite or run has been cancelled. */
    | 'CANCELLED'
    /** The check suite or run has failed. */
    | 'FAILURE'
    /** The check suite or run was neutral. */
    | 'NEUTRAL'
    /** The check suite or run was skipped. */
    | 'SKIPPED'
    /** The check suite or run was marked stale by GitHub. Only GitHub can use this conclusion. */
    | 'STALE'
    /** The check suite or run has failed at startup. */
    | 'STARTUP_FAILURE'
    /** The check suite or run has succeeded. */
    | 'SUCCESS'
    /** The check suite or run has timed out. */
    | 'TIMED_OUT';

/** The possible states of a check run in a status rollup. */
export type CheckRunState =
    /** The check run requires action. */
    | 'ACTION_REQUIRED'
    /** The check run has been cancelled. */
    | 'CANCELLED'
    /** The check run has been completed. */
    | 'COMPLETED'
    /** The check run has failed. */
    | 'FAILURE'
    /** The check run is in progress. */
    | 'IN_PROGRESS'
    /** The check run was neutral. */
    | 'NEUTRAL'
    /** The check run is in pending state. */
    | 'PENDING'
    /** The check run has been queued. */
    | 'QUEUED'
    /** The check run was skipped. */
    | 'SKIPPED'
    /** The check run was marked stale by GitHub. Only GitHub can use this conclusion. */
    | 'STALE'
    /** The check run has failed at startup. */
    | 'STARTUP_FAILURE'
    /** The check run has succeeded. */
    | 'SUCCESS'
    /** The check run has timed out. */
    | 'TIMED_OUT'
    /** The check run is in waiting state. */
    | 'WAITING';

/** The possible states for a check suite or run status. */
export type CheckStatusState =
    /** The check suite or run has been completed. */
    | 'COMPLETED'
    /** The check suite or run is in progress. */
    | 'IN_PROGRESS'
    /** The check suite or run is in pending state. */
    | 'PENDING'
    /** The check suite or run has been queued. */
    | 'QUEUED'
    /** The check suite or run has been requested. */
    | 'REQUESTED'
    /** The check suite or run is in waiting state. */
    | 'WAITING';

/** The possible state reasons of a closed issue. */
export type IssueClosedStateReason =
    /** An issue that has been closed as completed */
    | 'COMPLETED'
    /** An issue that has been closed as a duplicate */
    | 'DUPLICATE'
    /** An issue that has been closed as not planned */
    | 'NOT_PLANNED';

/** The possible states of an issue. */
export type IssueState =
    /** An issue that has been closed */
    | 'CLOSED'
    /** An issue that is still open */
    | 'OPEN';

/** The possible state reasons of an issue. */
export type IssueStateReason =
    /** An issue that has been closed as completed */
    | 'COMPLETED'
    /** An issue that has been closed as a duplicate. */
    | 'DUPLICATE'
    /** An issue that has been closed as not planned */
    | 'NOT_PLANNED'
    /** An issue that has been reopened */
    | 'REOPENED';

/** The possible color for an issue type */
export type IssueTypeColor =
    /** blue */
    | 'BLUE'
    /** gray */
    | 'GRAY'
    /** green */
    | 'GREEN'
    /** orange */
    | 'ORANGE'
    /** pink */
    | 'PINK'
    /** purple */
    | 'PURPLE'
    /** red */
    | 'RED'
    /** yellow */
    | 'YELLOW';

/** Detailed status information about a pull request merge. */
export type MergeStateStatus =
    /** The head ref is out of date. */
    | 'BEHIND'
    /** The merge is blocked. */
    | 'BLOCKED'
    /** Mergeable and passing commit status. */
    | 'CLEAN'
    /** The merge commit cannot be cleanly created. */
    | 'DIRTY'
    /** The merge is blocked due to the pull request being a draft. */
    | 'DRAFT'
    /** Mergeable with passing commit status and pre-receive hooks. */
    | 'HAS_HOOKS'
    /** The state cannot currently be determined. */
    | 'UNKNOWN'
    /** Mergeable with non-passing commit status. */
    | 'UNSTABLE';

/** Whether or not a PullRequest can be merged. */
export type MergeableState =
    /** The pull request cannot be merged due to merge conflicts. */
    | 'CONFLICTING'
    /** The pull request can be merged. */
    | 'MERGEABLE'
    /** The mergeability of the pull request is still being calculated. */
    | 'UNKNOWN';

/** Possible directions in which to order a list of items when provided an `orderBy` argument. */
export type OrderDirection =
    /** Specifies an ascending order for a given `orderBy` argument. */
    | 'ASC'
    /** Specifies a descending order for a given `orderBy` argument. */
    | 'DESC';

/** The type of a project field. */
export type ProjectV2FieldType =
    /** Assignees */
    | 'ASSIGNEES'
    /** Closed */
    | 'CLOSED'
    /** Created */
    | 'CREATED'
    /** Date */
    | 'DATE'
    /** Issue type */
    | 'ISSUE_TYPE'
    /** Iteration */
    | 'ITERATION'
    /** Labels */
    | 'LABELS'
    /** Linked Pull Requests */
    | 'LINKED_PULL_REQUESTS'
    /** Milestone */
    | 'MILESTONE'
    /** Multi Select */
    | 'MULTI_SELECT'
    /** Number */
    | 'NUMBER'
    /** Parent issue */
    | 'PARENT_ISSUE'
    /** Repository */
    | 'REPOSITORY'
    /** Reviewers */
    | 'REVIEWERS'
    /** Single Select */
    | 'SINGLE_SELECT'
    /** Sub-issues progress */
    | 'SUB_ISSUES_PROGRESS'
    /** Text */
    | 'TEXT'
    /** Title */
    | 'TITLE'
    /** Tracked by */
    | 'TRACKED_BY'
    /** Tracks */
    | 'TRACKS'
    /** Updated */
    | 'UPDATED';

/** The values that can be used to update a field of an item inside a Project. Only 1 value can be updated at a time. */
export type ProjectV2FieldValue = {
    /** The ISO 8601 date to set on the field. */
    date?: string | null | undefined;
    /** The id of the iteration to set on the field. */
    iterationId?: string | null | undefined;
    /** The ids of the multi select options to set on the field. */
    multiSelectOptionIds?: Array<string> | null | undefined;
    /** The number to set on the field. */
    number?: number | null | undefined;
    /** The id of the single select option to set on the field. */
    singleSelectOptionId?: string | null | undefined;
    /** The text to set on the field. */
    text?: string | null | undefined;
};

/** The type of a project item. */
export type ProjectV2ItemType =
    /** Draft Issue */
    | 'DRAFT_ISSUE'
    /** Issue */
    | 'ISSUE'
    /** Pull Request */
    | 'PULL_REQUEST'
    /** Redacted Item */
    | 'REDACTED';

/** The display color of a single-select field option. */
export type ProjectV2SingleSelectFieldOptionColor =
    /** BLUE */
    | 'BLUE'
    /** GRAY */
    | 'GRAY'
    /** GREEN */
    | 'GREEN'
    /** ORANGE */
    | 'ORANGE'
    /** PINK */
    | 'PINK'
    /** PURPLE */
    | 'PURPLE'
    /** RED */
    | 'RED'
    /** YELLOW */
    | 'YELLOW';

/** The layout of a project v2 view. */
export type ProjectV2ViewLayout =
    /** Board layout */
    | 'BOARD_LAYOUT'
    /** Roadmap layout */
    | 'ROADMAP_LAYOUT'
    /** Table layout */
    | 'TABLE_LAYOUT';

/** The review status of a pull request. */
export type PullRequestReviewDecision =
    /** The pull request has received an approving review. */
    | 'APPROVED'
    /** Changes have been requested on the pull request. */
    | 'CHANGES_REQUESTED'
    /** A review is required before the pull request can be merged. */
    | 'REVIEW_REQUIRED';

/** The possible states of a pull request review. */
export type PullRequestReviewState =
    /** A review allowing the pull request to merge. */
    | 'APPROVED'
    /** A review blocking the pull request from merging. */
    | 'CHANGES_REQUESTED'
    /** An informational review. */
    | 'COMMENTED'
    /** A review that has been dismissed. */
    | 'DISMISSED'
    /** A review that has not yet been submitted. */
    | 'PENDING';

/** The possible states of a pull request. */
export type PullRequestState =
    /** A pull request that has been closed without being merged. */
    | 'CLOSED'
    /** A pull request that has been closed by being merged. */
    | 'MERGED'
    /** A pull request that is still open. */
    | 'OPEN';

/** Emojis that can be attached to Issues, Pull Requests and Comments. */
export type ReactionContent =
    /** Represents the `:confused:` emoji. */
    | 'CONFUSED'
    /** Represents the `:eyes:` emoji. */
    | 'EYES'
    /** Represents the `:heart:` emoji. */
    | 'HEART'
    /** Represents the `:hooray:` emoji. */
    | 'HOORAY'
    /** Represents the `:laugh:` emoji. */
    | 'LAUGH'
    /** Represents the `:rocket:` emoji. */
    | 'ROCKET'
    /** Represents the `:-1:` emoji. */
    | 'THUMBS_DOWN'
    /** Represents the `:+1:` emoji. */
    | 'THUMBS_UP';

/** The access level to a repository */
export type RepositoryPermission =
    /**
     * Can read, clone, and push to this repository. Can also manage issues, pull
     * requests, and repository settings, including adding collaborators
     */
    | 'ADMIN'
    /** Can read, clone, and push to this repository. They can also manage issues, pull requests, and some repository settings */
    | 'MAINTAIN'
    /** Can read and clone this repository. Can also open and comment on issues and pull requests */
    | 'READ'
    /** Can read and clone this repository. Can also manage issues and pull requests */
    | 'TRIAGE'
    /** Can read and clone this repository. Can also manage issues and pull requests, plus additional triage abilities */
    | 'TRIAGE_PLUS'
    /** Can read, clone, and push to this repository. Can also manage issues and pull requests */
    | 'WRITE';

/** The possible commit status states. */
export type StatusState =
    /** Status is errored. */
    | 'ERROR'
    /** Status is expected. */
    | 'EXPECTED'
    /** Status is failing. */
    | 'FAILURE'
    /** Status is pending. */
    | 'PENDING'
    /** Status is successful. */
    | 'SUCCESS';

export type ItemByNumberQueryVariables = Exact<{
    owner: string;
    name: string;
    number: number;
}>;

export type ItemByNumberQuery = { repository: { issueOrPullRequest: { id: string } | { id: string } | null } | null };

export type ItemDetailQueryVariables = Exact<{
    id: string;
}>;

export type ItemDetailQuery = {
    node:
        | {
              __typename: 'Issue';
              body: string;
              bodyHTML: string;
              id: string;
              url: string;
              number: number;
              title: string;
              stateReason: IssueStateReason | null;
              createdAt: string;
              updatedAt: string;
              closedAt: string | null;
              issueState: IssueState;
              reactionGroups: Array<{
                  content: ReactionContent;
                  viewerHasReacted: boolean;
                  reactors: { totalCount: number };
              }> | null;
              commentPage: {
                  totalCount: number;
                  pageInfo: { hasPreviousPage: boolean; startCursor: string | null };
                  nodes: Array<{
                      id: string;
                      url: string;
                      createdAt: string;
                      lastEditedAt: string | null;
                      bodyHTML: string;
                      author:
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | null;
                  } | null> | null;
              };
              parent: {
                  id: string;
                  url: string;
                  number: number;
                  title: string;
                  state: IssueState;
                  stateReason: IssueStateReason | null;
                  repository: { nameWithOwner: string };
              } | null;
              subIssues: {
                  totalCount: number;
                  nodes: Array<{
                      id: string;
                      url: string;
                      number: number;
                      title: string;
                      state: IssueState;
                      stateReason: IssueStateReason | null;
                      repository: { nameWithOwner: string };
                  } | null> | null;
              };
              blockedBy: {
                  totalCount: number;
                  nodes: Array<{
                      id: string;
                      url: string;
                      number: number;
                      title: string;
                      state: IssueState;
                      stateReason: IssueStateReason | null;
                      repository: { nameWithOwner: string };
                  } | null> | null;
              };
              blocking: {
                  totalCount: number;
                  nodes: Array<{
                      id: string;
                      url: string;
                      number: number;
                      title: string;
                      state: IssueState;
                      stateReason: IssueStateReason | null;
                      repository: { nameWithOwner: string };
                  } | null> | null;
              };
              projectItems: {
                  nodes: Array<{
                      id: string;
                      isArchived: boolean;
                      updatedAt: string;
                      project: {
                          viewerCanUpdate: boolean;
                          id: string;
                          title: string;
                          number: number;
                          url: string;
                          fields: {
                              nodes: Array<
                                  | { id: string; name: string; dataType: ProjectV2FieldType }
                                  | {
                                        id: string;
                                        name: string;
                                        dataType: ProjectV2FieldType;
                                        configuration: {
                                            iterations: Array<{
                                                id: string;
                                                title: string;
                                                startDate: string;
                                                duration: number;
                                            }>;
                                            completedIterations: Array<{
                                                id: string;
                                                title: string;
                                                startDate: string;
                                                duration: number;
                                            }>;
                                        };
                                    }
                                  | {
                                        id: string;
                                        name: string;
                                        dataType: ProjectV2FieldType;
                                        multiSelectOptions: Array<{
                                            id: string;
                                            name: string;
                                            color: ProjectV2SingleSelectFieldOptionColor;
                                        }>;
                                    }
                                  | {
                                        id: string;
                                        name: string;
                                        dataType: ProjectV2FieldType;
                                        options: Array<{
                                            id: string;
                                            name: string;
                                            color: ProjectV2SingleSelectFieldOptionColor;
                                        }>;
                                    }
                                  | null
                              > | null;
                          };
                      };
                      fieldValueByName:
                          | {
                                name: string | null;
                                color: ProjectV2SingleSelectFieldOptionColor;
                                optionId: string | null;
                            }
                          | Record<PropertyKey, never>
                          | null;
                      fieldValues: {
                          nodes: Array<
                              | {
                                    __typename: 'ProjectV2ItemFieldDateValue';
                                    date: string | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldIterationValue';
                                    iterationId: string;
                                    title: string;
                                    startDate: string;
                                    duration: number;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldLabelValue' }
                              | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
                              | {
                                    __typename: 'ProjectV2ItemFieldMultiSelectValue';
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                    options: Array<{
                                        id: string;
                                        name: string;
                                        color: ProjectV2SingleSelectFieldOptionColor;
                                    }> | null;
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldNumberValue';
                                    number: number | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
                              | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
                              | { __typename: 'ProjectV2ItemFieldReviewerValue' }
                              | {
                                    __typename: 'ProjectV2ItemFieldSingleSelectValue';
                                    optionId: string | null;
                                    name: string | null;
                                    color: ProjectV2SingleSelectFieldOptionColor;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldTextValue';
                                    text: string | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldUserValue' }
                              | { __typename: 'ProjectV2ItemIssueFieldValue' }
                              | null
                          > | null;
                      };
                  } | null> | null;
              } | null;
              author:
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | null;
              assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
              labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
              milestone: { title: string; dueOn: string | null } | null;
              issueType: { name: string; color: IssueTypeColor } | null;
              comments: { totalCount: number };
              subIssuesSummary: { total: number; completed: number };
              repository: {
                  nameWithOwner: string;
                  isPrivate: boolean;
                  viewerPermission: RepositoryPermission | null;
                  owner: { login: string } | { login: string };
              };
          }
        | {
              __typename: 'PullRequest';
              body: string;
              bodyHTML: string;
              url: string;
              number: number;
              title: string;
              createdAt: string;
              closedAt: string | null;
              additions: number;
              deletions: number;
              changedFiles: number;
              headRefName: string;
              baseRefName: string;
              id: string;
              updatedAt: string;
              state: PullRequestState;
              isDraft: boolean;
              merged: boolean;
              reviewDecision: PullRequestReviewDecision | null;
              mergeable: MergeableState;
              mergeStateStatus: MergeStateStatus;
              baseRefOid: string;
              reactionGroups: Array<{
                  content: ReactionContent;
                  viewerHasReacted: boolean;
                  reactors: { totalCount: number };
              }> | null;
              commentPage: {
                  totalCount: number;
                  pageInfo: { hasPreviousPage: boolean; startCursor: string | null };
                  nodes: Array<{
                      id: string;
                      url: string;
                      createdAt: string;
                      lastEditedAt: string | null;
                      bodyHTML: string;
                      author:
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | null;
                  } | null> | null;
              };
              commits: { totalCount: number };
              headRepository: { nameWithOwner: string } | null;
              statusCheckRollup: {
                  state: StatusState;
                  contextPage: {
                      totalCount: number;
                      nodes: Array<
                          | {
                                __typename: 'CheckRun';
                                id: string;
                                name: string;
                                status: CheckStatusState;
                                conclusion: CheckConclusionState | null;
                                detailsUrl: string | null;
                                startedAt: string | null;
                                completedAt: string | null;
                                checkSuite: { workflowRun: { workflow: { name: string } } | null };
                            }
                          | {
                                __typename: 'StatusContext';
                                id: string;
                                context: string;
                                state: StatusState;
                                targetUrl: string | null;
                                createdAt: string;
                            }
                          | null
                      > | null;
                  };
                  contexts: {
                      checkRunCountsByState: Array<{ state: CheckRunState; count: number }> | null;
                      statusContextCountsByState: Array<{ state: StatusState; count: number }> | null;
                  };
              } | null;
              latestReviews: {
                  nodes: Array<{
                      state: PullRequestReviewState;
                      submittedAt: string | null;
                      author:
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | null;
                  } | null> | null;
              } | null;
              reviewRequests: {
                  nodes: Array<{
                      requestedReviewer:
                          | { slug: string; name: string }
                          | { avatarUrl: string; login: string }
                          | Record<PropertyKey, never>
                          | null;
                  } | null> | null;
              } | null;
              projectItems: {
                  nodes: Array<{
                      id: string;
                      isArchived: boolean;
                      updatedAt: string;
                      project: {
                          viewerCanUpdate: boolean;
                          id: string;
                          title: string;
                          number: number;
                          url: string;
                          fields: {
                              nodes: Array<
                                  | { id: string; name: string; dataType: ProjectV2FieldType }
                                  | {
                                        id: string;
                                        name: string;
                                        dataType: ProjectV2FieldType;
                                        configuration: {
                                            iterations: Array<{
                                                id: string;
                                                title: string;
                                                startDate: string;
                                                duration: number;
                                            }>;
                                            completedIterations: Array<{
                                                id: string;
                                                title: string;
                                                startDate: string;
                                                duration: number;
                                            }>;
                                        };
                                    }
                                  | {
                                        id: string;
                                        name: string;
                                        dataType: ProjectV2FieldType;
                                        multiSelectOptions: Array<{
                                            id: string;
                                            name: string;
                                            color: ProjectV2SingleSelectFieldOptionColor;
                                        }>;
                                    }
                                  | {
                                        id: string;
                                        name: string;
                                        dataType: ProjectV2FieldType;
                                        options: Array<{
                                            id: string;
                                            name: string;
                                            color: ProjectV2SingleSelectFieldOptionColor;
                                        }>;
                                    }
                                  | null
                              > | null;
                          };
                      };
                      fieldValueByName:
                          | {
                                name: string | null;
                                color: ProjectV2SingleSelectFieldOptionColor;
                                optionId: string | null;
                            }
                          | Record<PropertyKey, never>
                          | null;
                      fieldValues: {
                          nodes: Array<
                              | {
                                    __typename: 'ProjectV2ItemFieldDateValue';
                                    date: string | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldIterationValue';
                                    iterationId: string;
                                    title: string;
                                    startDate: string;
                                    duration: number;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldLabelValue' }
                              | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
                              | {
                                    __typename: 'ProjectV2ItemFieldMultiSelectValue';
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                    options: Array<{
                                        id: string;
                                        name: string;
                                        color: ProjectV2SingleSelectFieldOptionColor;
                                    }> | null;
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldNumberValue';
                                    number: number | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
                              | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
                              | { __typename: 'ProjectV2ItemFieldReviewerValue' }
                              | {
                                    __typename: 'ProjectV2ItemFieldSingleSelectValue';
                                    optionId: string | null;
                                    name: string | null;
                                    color: ProjectV2SingleSelectFieldOptionColor;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldTextValue';
                                    text: string | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldUserValue' }
                              | { __typename: 'ProjectV2ItemIssueFieldValue' }
                              | null
                          > | null;
                      };
                  } | null> | null;
              } | null;
              author:
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | null;
              assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
              labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
              milestone: { title: string; dueOn: string | null } | null;
              comments: { totalCount: number };
              closingIssuesReferences: { nodes: Array<{ id: string } | null> | null } | null;
              repository: {
                  nameWithOwner: string;
                  isPrivate: boolean;
                  viewerPermission: RepositoryPermission | null;
                  owner: { login: string } | { login: string };
              };
              stack: { id: string; number: number; size: number } | null;
              stackEntry: { position: number } | null;
              baseRef: { target: { oid: string } | { oid: string } | { oid: string } | { oid: string } | null } | null;
              latestOpinionatedReviews: {
                  nodes: Array<{
                      state: PullRequestReviewState;
                      author:
                          | { login: string }
                          | { login: string }
                          | { login: string }
                          | { login: string }
                          | { login: string }
                          | null;
                  } | null> | null;
              } | null;
          }
        | Record<PropertyKey, never>
        | null;
};

export type ItemDetailsQueryVariables = Exact<{
    ids: Array<string> | string;
}>;

export type ItemDetailsQuery = {
    nodes: Array<
        | {
              __typename: 'Issue';
              body: string;
              bodyHTML: string;
              id: string;
              url: string;
              number: number;
              title: string;
              stateReason: IssueStateReason | null;
              createdAt: string;
              updatedAt: string;
              closedAt: string | null;
              issueState: IssueState;
              reactionGroups: Array<{
                  content: ReactionContent;
                  viewerHasReacted: boolean;
                  reactors: { totalCount: number };
              }> | null;
              commentPage: {
                  totalCount: number;
                  pageInfo: { hasPreviousPage: boolean; startCursor: string | null };
                  nodes: Array<{
                      id: string;
                      url: string;
                      createdAt: string;
                      lastEditedAt: string | null;
                      bodyHTML: string;
                      author:
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | null;
                  } | null> | null;
              };
              parent: {
                  id: string;
                  url: string;
                  number: number;
                  title: string;
                  state: IssueState;
                  stateReason: IssueStateReason | null;
                  repository: { nameWithOwner: string };
              } | null;
              subIssues: {
                  totalCount: number;
                  nodes: Array<{
                      id: string;
                      url: string;
                      number: number;
                      title: string;
                      state: IssueState;
                      stateReason: IssueStateReason | null;
                      repository: { nameWithOwner: string };
                  } | null> | null;
              };
              blockedBy: {
                  totalCount: number;
                  nodes: Array<{
                      id: string;
                      url: string;
                      number: number;
                      title: string;
                      state: IssueState;
                      stateReason: IssueStateReason | null;
                      repository: { nameWithOwner: string };
                  } | null> | null;
              };
              blocking: {
                  totalCount: number;
                  nodes: Array<{
                      id: string;
                      url: string;
                      number: number;
                      title: string;
                      state: IssueState;
                      stateReason: IssueStateReason | null;
                      repository: { nameWithOwner: string };
                  } | null> | null;
              };
              projectItems: {
                  nodes: Array<{
                      id: string;
                      isArchived: boolean;
                      updatedAt: string;
                      project: {
                          viewerCanUpdate: boolean;
                          id: string;
                          title: string;
                          number: number;
                          url: string;
                          fields: {
                              nodes: Array<
                                  | { id: string; name: string; dataType: ProjectV2FieldType }
                                  | {
                                        id: string;
                                        name: string;
                                        dataType: ProjectV2FieldType;
                                        configuration: {
                                            iterations: Array<{
                                                id: string;
                                                title: string;
                                                startDate: string;
                                                duration: number;
                                            }>;
                                            completedIterations: Array<{
                                                id: string;
                                                title: string;
                                                startDate: string;
                                                duration: number;
                                            }>;
                                        };
                                    }
                                  | {
                                        id: string;
                                        name: string;
                                        dataType: ProjectV2FieldType;
                                        multiSelectOptions: Array<{
                                            id: string;
                                            name: string;
                                            color: ProjectV2SingleSelectFieldOptionColor;
                                        }>;
                                    }
                                  | {
                                        id: string;
                                        name: string;
                                        dataType: ProjectV2FieldType;
                                        options: Array<{
                                            id: string;
                                            name: string;
                                            color: ProjectV2SingleSelectFieldOptionColor;
                                        }>;
                                    }
                                  | null
                              > | null;
                          };
                      };
                      fieldValueByName:
                          | {
                                name: string | null;
                                color: ProjectV2SingleSelectFieldOptionColor;
                                optionId: string | null;
                            }
                          | Record<PropertyKey, never>
                          | null;
                      fieldValues: {
                          nodes: Array<
                              | {
                                    __typename: 'ProjectV2ItemFieldDateValue';
                                    date: string | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldIterationValue';
                                    iterationId: string;
                                    title: string;
                                    startDate: string;
                                    duration: number;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldLabelValue' }
                              | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
                              | {
                                    __typename: 'ProjectV2ItemFieldMultiSelectValue';
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                    options: Array<{
                                        id: string;
                                        name: string;
                                        color: ProjectV2SingleSelectFieldOptionColor;
                                    }> | null;
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldNumberValue';
                                    number: number | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
                              | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
                              | { __typename: 'ProjectV2ItemFieldReviewerValue' }
                              | {
                                    __typename: 'ProjectV2ItemFieldSingleSelectValue';
                                    optionId: string | null;
                                    name: string | null;
                                    color: ProjectV2SingleSelectFieldOptionColor;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldTextValue';
                                    text: string | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldUserValue' }
                              | { __typename: 'ProjectV2ItemIssueFieldValue' }
                              | null
                          > | null;
                      };
                  } | null> | null;
              } | null;
              author:
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | null;
              assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
              labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
              milestone: { title: string; dueOn: string | null } | null;
              issueType: { name: string; color: IssueTypeColor } | null;
              comments: { totalCount: number };
              subIssuesSummary: { total: number; completed: number };
              repository: {
                  nameWithOwner: string;
                  isPrivate: boolean;
                  viewerPermission: RepositoryPermission | null;
                  owner: { login: string } | { login: string };
              };
          }
        | {
              __typename: 'PullRequest';
              body: string;
              bodyHTML: string;
              url: string;
              number: number;
              title: string;
              createdAt: string;
              closedAt: string | null;
              additions: number;
              deletions: number;
              changedFiles: number;
              headRefName: string;
              baseRefName: string;
              id: string;
              updatedAt: string;
              state: PullRequestState;
              isDraft: boolean;
              merged: boolean;
              reviewDecision: PullRequestReviewDecision | null;
              mergeable: MergeableState;
              mergeStateStatus: MergeStateStatus;
              baseRefOid: string;
              reactionGroups: Array<{
                  content: ReactionContent;
                  viewerHasReacted: boolean;
                  reactors: { totalCount: number };
              }> | null;
              commentPage: {
                  totalCount: number;
                  pageInfo: { hasPreviousPage: boolean; startCursor: string | null };
                  nodes: Array<{
                      id: string;
                      url: string;
                      createdAt: string;
                      lastEditedAt: string | null;
                      bodyHTML: string;
                      author:
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | null;
                  } | null> | null;
              };
              commits: { totalCount: number };
              headRepository: { nameWithOwner: string } | null;
              statusCheckRollup: {
                  state: StatusState;
                  contextPage: {
                      totalCount: number;
                      nodes: Array<
                          | {
                                __typename: 'CheckRun';
                                id: string;
                                name: string;
                                status: CheckStatusState;
                                conclusion: CheckConclusionState | null;
                                detailsUrl: string | null;
                                startedAt: string | null;
                                completedAt: string | null;
                                checkSuite: { workflowRun: { workflow: { name: string } } | null };
                            }
                          | {
                                __typename: 'StatusContext';
                                id: string;
                                context: string;
                                state: StatusState;
                                targetUrl: string | null;
                                createdAt: string;
                            }
                          | null
                      > | null;
                  };
                  contexts: {
                      checkRunCountsByState: Array<{ state: CheckRunState; count: number }> | null;
                      statusContextCountsByState: Array<{ state: StatusState; count: number }> | null;
                  };
              } | null;
              latestReviews: {
                  nodes: Array<{
                      state: PullRequestReviewState;
                      submittedAt: string | null;
                      author:
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | null;
                  } | null> | null;
              } | null;
              reviewRequests: {
                  nodes: Array<{
                      requestedReviewer:
                          | { slug: string; name: string }
                          | { avatarUrl: string; login: string }
                          | Record<PropertyKey, never>
                          | null;
                  } | null> | null;
              } | null;
              projectItems: {
                  nodes: Array<{
                      id: string;
                      isArchived: boolean;
                      updatedAt: string;
                      project: {
                          viewerCanUpdate: boolean;
                          id: string;
                          title: string;
                          number: number;
                          url: string;
                          fields: {
                              nodes: Array<
                                  | { id: string; name: string; dataType: ProjectV2FieldType }
                                  | {
                                        id: string;
                                        name: string;
                                        dataType: ProjectV2FieldType;
                                        configuration: {
                                            iterations: Array<{
                                                id: string;
                                                title: string;
                                                startDate: string;
                                                duration: number;
                                            }>;
                                            completedIterations: Array<{
                                                id: string;
                                                title: string;
                                                startDate: string;
                                                duration: number;
                                            }>;
                                        };
                                    }
                                  | {
                                        id: string;
                                        name: string;
                                        dataType: ProjectV2FieldType;
                                        multiSelectOptions: Array<{
                                            id: string;
                                            name: string;
                                            color: ProjectV2SingleSelectFieldOptionColor;
                                        }>;
                                    }
                                  | {
                                        id: string;
                                        name: string;
                                        dataType: ProjectV2FieldType;
                                        options: Array<{
                                            id: string;
                                            name: string;
                                            color: ProjectV2SingleSelectFieldOptionColor;
                                        }>;
                                    }
                                  | null
                              > | null;
                          };
                      };
                      fieldValueByName:
                          | {
                                name: string | null;
                                color: ProjectV2SingleSelectFieldOptionColor;
                                optionId: string | null;
                            }
                          | Record<PropertyKey, never>
                          | null;
                      fieldValues: {
                          nodes: Array<
                              | {
                                    __typename: 'ProjectV2ItemFieldDateValue';
                                    date: string | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldIterationValue';
                                    iterationId: string;
                                    title: string;
                                    startDate: string;
                                    duration: number;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldLabelValue' }
                              | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
                              | {
                                    __typename: 'ProjectV2ItemFieldMultiSelectValue';
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                    options: Array<{
                                        id: string;
                                        name: string;
                                        color: ProjectV2SingleSelectFieldOptionColor;
                                    }> | null;
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldNumberValue';
                                    number: number | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
                              | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
                              | { __typename: 'ProjectV2ItemFieldReviewerValue' }
                              | {
                                    __typename: 'ProjectV2ItemFieldSingleSelectValue';
                                    optionId: string | null;
                                    name: string | null;
                                    color: ProjectV2SingleSelectFieldOptionColor;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldTextValue';
                                    text: string | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldUserValue' }
                              | { __typename: 'ProjectV2ItemIssueFieldValue' }
                              | null
                          > | null;
                      };
                  } | null> | null;
              } | null;
              author:
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | null;
              assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
              labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
              milestone: { title: string; dueOn: string | null } | null;
              comments: { totalCount: number };
              closingIssuesReferences: { nodes: Array<{ id: string } | null> | null } | null;
              repository: {
                  nameWithOwner: string;
                  isPrivate: boolean;
                  viewerPermission: RepositoryPermission | null;
                  owner: { login: string } | { login: string };
              };
              stack: { id: string; number: number; size: number } | null;
              stackEntry: { position: number } | null;
              baseRef: { target: { oid: string } | { oid: string } | { oid: string } | { oid: string } | null } | null;
              latestOpinionatedReviews: {
                  nodes: Array<{
                      state: PullRequestReviewState;
                      author:
                          | { login: string }
                          | { login: string }
                          | { login: string }
                          | { login: string }
                          | { login: string }
                          | null;
                  } | null> | null;
              } | null;
          }
        | Record<PropertyKey, never>
        | null
    >;
};

export type ItemsByIdsQueryVariables = Exact<{
    ids: Array<string> | string;
}>;

export type ItemsByIdsQuery = {
    nodes: Array<
        | {
              __typename: 'Issue';
              id: string;
              url: string;
              number: number;
              title: string;
              stateReason: IssueStateReason | null;
              createdAt: string;
              updatedAt: string;
              closedAt: string | null;
              issueState: IssueState;
              author:
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | null;
              assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
              labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
              milestone: { title: string; dueOn: string | null } | null;
              issueType: { name: string; color: IssueTypeColor } | null;
              comments: { totalCount: number };
              subIssuesSummary: { total: number; completed: number };
              repository: {
                  nameWithOwner: string;
                  isPrivate: boolean;
                  viewerPermission: RepositoryPermission | null;
                  owner: { login: string } | { login: string };
              };
              projectItems: {
                  nodes: Array<{
                      id: string;
                      isArchived: boolean;
                      updatedAt: string;
                      project: { id: string; title: string; number: number; url: string };
                      fieldValueByName:
                          | {
                                name: string | null;
                                color: ProjectV2SingleSelectFieldOptionColor;
                                optionId: string | null;
                            }
                          | Record<PropertyKey, never>
                          | null;
                  } | null> | null;
              } | null;
          }
        | {
              __typename: 'PullRequest';
              url: string;
              number: number;
              title: string;
              createdAt: string;
              closedAt: string | null;
              additions: number;
              deletions: number;
              changedFiles: number;
              headRefName: string;
              baseRefName: string;
              id: string;
              updatedAt: string;
              state: PullRequestState;
              isDraft: boolean;
              merged: boolean;
              reviewDecision: PullRequestReviewDecision | null;
              mergeable: MergeableState;
              mergeStateStatus: MergeStateStatus;
              baseRefOid: string;
              author:
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | null;
              assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
              labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
              milestone: { title: string; dueOn: string | null } | null;
              comments: { totalCount: number };
              closingIssuesReferences: { nodes: Array<{ id: string } | null> | null } | null;
              repository: {
                  nameWithOwner: string;
                  isPrivate: boolean;
                  viewerPermission: RepositoryPermission | null;
                  owner: { login: string } | { login: string };
              };
              projectItems: {
                  nodes: Array<{
                      id: string;
                      isArchived: boolean;
                      updatedAt: string;
                      project: { id: string; title: string; number: number; url: string };
                      fieldValueByName:
                          | {
                                name: string | null;
                                color: ProjectV2SingleSelectFieldOptionColor;
                                optionId: string | null;
                            }
                          | Record<PropertyKey, never>
                          | null;
                  } | null> | null;
              } | null;
              stack: { id: string; number: number; size: number } | null;
              stackEntry: { position: number } | null;
              baseRef: { target: { oid: string } | { oid: string } | { oid: string } | { oid: string } | null } | null;
              statusCheckRollup: {
                  state: StatusState;
                  contexts: {
                      checkRunCountsByState: Array<{ state: CheckRunState; count: number }> | null;
                      statusContextCountsByState: Array<{ state: StatusState; count: number }> | null;
                  };
              } | null;
              reviewRequests: {
                  nodes: Array<{
                      requestedReviewer:
                          | { slug: string; name: string }
                          | { login: string }
                          | Record<PropertyKey, never>
                          | null;
                  } | null> | null;
              } | null;
              latestOpinionatedReviews: {
                  nodes: Array<{
                      state: PullRequestReviewState;
                      author:
                          | { login: string }
                          | { login: string }
                          | { login: string }
                          | { login: string }
                          | { login: string }
                          | null;
                  } | null> | null;
              } | null;
          }
        | Record<PropertyKey, never>
        | null
    >;
};

export type MoreCommentsQueryVariables = Exact<{
    id: string;
    before: string;
}>;

export type MoreCommentsQuery = {
    node:
        | {
              id: string;
              commentPage: {
                  totalCount: number;
                  pageInfo: { hasPreviousPage: boolean; startCursor: string | null };
                  nodes: Array<{
                      id: string;
                      url: string;
                      createdAt: string;
                      lastEditedAt: string | null;
                      bodyHTML: string;
                      author:
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | null;
                  } | null> | null;
              };
          }
        | {
              id: string;
              commentPage: {
                  totalCount: number;
                  pageInfo: { hasPreviousPage: boolean; startCursor: string | null };
                  nodes: Array<{
                      id: string;
                      url: string;
                      createdAt: string;
                      lastEditedAt: string | null;
                      bodyHTML: string;
                      author:
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | null;
                  } | null> | null;
              };
          }
        | Record<PropertyKey, never>
        | null;
};

export type OrganizationRepositoriesQueryVariables = Exact<{
    login: string;
    after?: string | null | undefined;
}>;

export type OrganizationRepositoriesQuery = {
    organization: {
        repositories: {
            totalCount: number;
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{
                id: string;
                nameWithOwner: string;
                isPrivate: boolean;
                isArchived: boolean;
                pushedAt: string | null;
                viewerPermission: RepositoryPermission | null;
                owner: { login: string } | { login: string };
                issues: { totalCount: number };
                pullRequests: { totalCount: number };
            } | null> | null;
        };
    } | null;
};

export type ProjectForTrackingQueryVariables = Exact<{
    login: string;
    number: number;
}>;

export type ProjectForTrackingQuery = {
    repositoryOwner:
        | {
              projectV2: {
                  id: string;
                  title: string;
                  number: number;
                  url: string;
                  closed: boolean;
                  updatedAt: string;
                  items: { totalCount: number };
                  owner:
                      | { __typename: 'Issue' }
                      | { __typename: 'Organization'; login: string }
                      | { __typename: 'PullRequest' }
                      | { __typename: 'User'; login: string };
              } | null;
          }
        | {
              projectV2: {
                  id: string;
                  title: string;
                  number: number;
                  url: string;
                  closed: boolean;
                  updatedAt: string;
                  items: { totalCount: number };
                  owner:
                      | { __typename: 'Issue' }
                      | { __typename: 'Organization'; login: string }
                      | { __typename: 'PullRequest' }
                      | { __typename: 'User'; login: string };
              } | null;
          }
        | null;
};

export type ProjectFullQueryVariables = Exact<{
    id: string;
}>;

export type ProjectFullQuery = {
    node:
        | {
              id: string;
              title: string;
              number: number;
              url: string;
              closed: boolean;
              updatedAt: string;
              viewerCanUpdate: boolean;
              owner:
                  | { __typename: 'Issue' }
                  | { __typename: 'Organization'; login: string }
                  | { __typename: 'PullRequest' }
                  | { __typename: 'User'; login: string };
              fields: {
                  nodes: Array<
                      | { id: string; name: string; dataType: ProjectV2FieldType }
                      | {
                            id: string;
                            name: string;
                            dataType: ProjectV2FieldType;
                            configuration: {
                                iterations: Array<{ id: string; title: string; startDate: string; duration: number }>;
                                completedIterations: Array<{
                                    id: string;
                                    title: string;
                                    startDate: string;
                                    duration: number;
                                }>;
                            };
                        }
                      | {
                            id: string;
                            name: string;
                            dataType: ProjectV2FieldType;
                            multiSelectOptions: Array<{
                                id: string;
                                name: string;
                                color: ProjectV2SingleSelectFieldOptionColor;
                            }>;
                        }
                      | {
                            id: string;
                            name: string;
                            dataType: ProjectV2FieldType;
                            options: Array<{ id: string; name: string; color: ProjectV2SingleSelectFieldOptionColor }>;
                        }
                      | null
                  > | null;
              };
              views: {
                  nodes: Array<{
                      id: string;
                      number: number;
                      name: string;
                      layout: ProjectV2ViewLayout;
                      filter: string | null;
                      groupByFields: {
                          nodes: Array<
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | null
                          > | null;
                      } | null;
                      verticalGroupByFields: {
                          nodes: Array<
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | null
                          > | null;
                      } | null;
                      sortByFields: {
                          nodes: Array<{
                              direction: OrderDirection;
                              field:
                                  | { id: string; name: string }
                                  | { id: string; name: string }
                                  | { id: string; name: string }
                                  | { id: string; name: string };
                          } | null> | null;
                      } | null;
                      fields: {
                          nodes: Array<
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | null
                          > | null;
                      } | null;
                  } | null> | null;
              };
              items: {
                  totalCount: number;
                  pageInfo: { hasNextPage: boolean; endCursor: string | null };
                  nodes: Array<{
                      isArchived: boolean;
                      type: ProjectV2ItemType;
                      id: string;
                      updatedAt: string;
                      content:
                          | {
                                __typename: 'DraftIssue';
                                id: string;
                                title: string;
                                body: string;
                                createdAt: string;
                                updatedAt: string;
                                creator:
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | null;
                                assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
                            }
                          | {
                                __typename: 'Issue';
                                id: string;
                                url: string;
                                number: number;
                                title: string;
                                stateReason: IssueStateReason | null;
                                createdAt: string;
                                updatedAt: string;
                                closedAt: string | null;
                                issueState: IssueState;
                                author:
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | null;
                                assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
                                labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
                                milestone: { title: string; dueOn: string | null } | null;
                                issueType: { name: string; color: IssueTypeColor } | null;
                                comments: { totalCount: number };
                                subIssuesSummary: { total: number; completed: number };
                                repository: {
                                    nameWithOwner: string;
                                    isPrivate: boolean;
                                    viewerPermission: RepositoryPermission | null;
                                    owner: { login: string } | { login: string };
                                };
                                projectItems: {
                                    nodes: Array<{
                                        id: string;
                                        isArchived: boolean;
                                        updatedAt: string;
                                        project: { id: string; title: string; number: number; url: string };
                                        fieldValueByName:
                                            | {
                                                  name: string | null;
                                                  color: ProjectV2SingleSelectFieldOptionColor;
                                                  optionId: string | null;
                                              }
                                            | Record<PropertyKey, never>
                                            | null;
                                    } | null> | null;
                                } | null;
                            }
                          | {
                                __typename: 'PullRequest';
                                url: string;
                                number: number;
                                title: string;
                                createdAt: string;
                                closedAt: string | null;
                                additions: number;
                                deletions: number;
                                changedFiles: number;
                                headRefName: string;
                                baseRefName: string;
                                id: string;
                                updatedAt: string;
                                state: PullRequestState;
                                isDraft: boolean;
                                merged: boolean;
                                reviewDecision: PullRequestReviewDecision | null;
                                mergeable: MergeableState;
                                mergeStateStatus: MergeStateStatus;
                                baseRefOid: string;
                                author:
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | null;
                                assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
                                labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
                                milestone: { title: string; dueOn: string | null } | null;
                                comments: { totalCount: number };
                                closingIssuesReferences: { nodes: Array<{ id: string } | null> | null } | null;
                                repository: {
                                    nameWithOwner: string;
                                    isPrivate: boolean;
                                    viewerPermission: RepositoryPermission | null;
                                    owner: { login: string } | { login: string };
                                };
                                projectItems: {
                                    nodes: Array<{
                                        id: string;
                                        isArchived: boolean;
                                        updatedAt: string;
                                        project: { id: string; title: string; number: number; url: string };
                                        fieldValueByName:
                                            | {
                                                  name: string | null;
                                                  color: ProjectV2SingleSelectFieldOptionColor;
                                                  optionId: string | null;
                                              }
                                            | Record<PropertyKey, never>
                                            | null;
                                    } | null> | null;
                                } | null;
                                stack: { id: string; number: number; size: number } | null;
                                stackEntry: { position: number } | null;
                                baseRef: {
                                    target:
                                        | { oid: string }
                                        | { oid: string }
                                        | { oid: string }
                                        | { oid: string }
                                        | null;
                                } | null;
                                statusCheckRollup: {
                                    state: StatusState;
                                    contexts: {
                                        checkRunCountsByState: Array<{ state: CheckRunState; count: number }> | null;
                                        statusContextCountsByState: Array<{ state: StatusState; count: number }> | null;
                                    };
                                } | null;
                                reviewRequests: {
                                    nodes: Array<{
                                        requestedReviewer:
                                            | { slug: string; name: string }
                                            | { login: string }
                                            | Record<PropertyKey, never>
                                            | null;
                                    } | null> | null;
                                } | null;
                                latestOpinionatedReviews: {
                                    nodes: Array<{
                                        state: PullRequestReviewState;
                                        author:
                                            | { login: string }
                                            | { login: string }
                                            | { login: string }
                                            | { login: string }
                                            | { login: string }
                                            | null;
                                    } | null> | null;
                                } | null;
                            }
                          | null;
                      fieldValues: {
                          nodes: Array<
                              | {
                                    __typename: 'ProjectV2ItemFieldDateValue';
                                    date: string | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldIterationValue';
                                    iterationId: string;
                                    title: string;
                                    startDate: string;
                                    duration: number;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldLabelValue' }
                              | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
                              | {
                                    __typename: 'ProjectV2ItemFieldMultiSelectValue';
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                    options: Array<{
                                        id: string;
                                        name: string;
                                        color: ProjectV2SingleSelectFieldOptionColor;
                                    }> | null;
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldNumberValue';
                                    number: number | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
                              | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
                              | { __typename: 'ProjectV2ItemFieldReviewerValue' }
                              | {
                                    __typename: 'ProjectV2ItemFieldSingleSelectValue';
                                    optionId: string | null;
                                    name: string | null;
                                    color: ProjectV2SingleSelectFieldOptionColor;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldTextValue';
                                    text: string | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldUserValue' }
                              | { __typename: 'ProjectV2ItemIssueFieldValue' }
                              | null
                          > | null;
                      };
                  } | null> | null;
              };
          }
        | Record<PropertyKey, never>
        | null;
};

export type ProjectItemsQueryVariables = Exact<{
    id: string;
    query: string;
    first: number;
    after?: string | null | undefined;
}>;

export type ProjectItemsQuery = {
    node:
        | {
              items: {
                  totalCount: number;
                  pageInfo: { hasNextPage: boolean; endCursor: string | null };
                  nodes: Array<{
                      isArchived: boolean;
                      type: ProjectV2ItemType;
                      id: string;
                      updatedAt: string;
                      content:
                          | {
                                __typename: 'DraftIssue';
                                id: string;
                                title: string;
                                body: string;
                                createdAt: string;
                                updatedAt: string;
                                creator:
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | null;
                                assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
                            }
                          | {
                                __typename: 'Issue';
                                id: string;
                                url: string;
                                number: number;
                                title: string;
                                stateReason: IssueStateReason | null;
                                createdAt: string;
                                updatedAt: string;
                                closedAt: string | null;
                                issueState: IssueState;
                                author:
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | null;
                                assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
                                labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
                                milestone: { title: string; dueOn: string | null } | null;
                                issueType: { name: string; color: IssueTypeColor } | null;
                                comments: { totalCount: number };
                                subIssuesSummary: { total: number; completed: number };
                                repository: {
                                    nameWithOwner: string;
                                    isPrivate: boolean;
                                    viewerPermission: RepositoryPermission | null;
                                    owner: { login: string } | { login: string };
                                };
                                projectItems: {
                                    nodes: Array<{
                                        id: string;
                                        isArchived: boolean;
                                        updatedAt: string;
                                        project: { id: string; title: string; number: number; url: string };
                                        fieldValueByName:
                                            | {
                                                  name: string | null;
                                                  color: ProjectV2SingleSelectFieldOptionColor;
                                                  optionId: string | null;
                                              }
                                            | Record<PropertyKey, never>
                                            | null;
                                    } | null> | null;
                                } | null;
                            }
                          | {
                                __typename: 'PullRequest';
                                url: string;
                                number: number;
                                title: string;
                                createdAt: string;
                                closedAt: string | null;
                                additions: number;
                                deletions: number;
                                changedFiles: number;
                                headRefName: string;
                                baseRefName: string;
                                id: string;
                                updatedAt: string;
                                state: PullRequestState;
                                isDraft: boolean;
                                merged: boolean;
                                reviewDecision: PullRequestReviewDecision | null;
                                mergeable: MergeableState;
                                mergeStateStatus: MergeStateStatus;
                                baseRefOid: string;
                                author:
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | { login: string; avatarUrl: string }
                                    | null;
                                assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
                                labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
                                milestone: { title: string; dueOn: string | null } | null;
                                comments: { totalCount: number };
                                closingIssuesReferences: { nodes: Array<{ id: string } | null> | null } | null;
                                repository: {
                                    nameWithOwner: string;
                                    isPrivate: boolean;
                                    viewerPermission: RepositoryPermission | null;
                                    owner: { login: string } | { login: string };
                                };
                                projectItems: {
                                    nodes: Array<{
                                        id: string;
                                        isArchived: boolean;
                                        updatedAt: string;
                                        project: { id: string; title: string; number: number; url: string };
                                        fieldValueByName:
                                            | {
                                                  name: string | null;
                                                  color: ProjectV2SingleSelectFieldOptionColor;
                                                  optionId: string | null;
                                              }
                                            | Record<PropertyKey, never>
                                            | null;
                                    } | null> | null;
                                } | null;
                                stack: { id: string; number: number; size: number } | null;
                                stackEntry: { position: number } | null;
                                baseRef: {
                                    target:
                                        | { oid: string }
                                        | { oid: string }
                                        | { oid: string }
                                        | { oid: string }
                                        | null;
                                } | null;
                                statusCheckRollup: {
                                    state: StatusState;
                                    contexts: {
                                        checkRunCountsByState: Array<{ state: CheckRunState; count: number }> | null;
                                        statusContextCountsByState: Array<{ state: StatusState; count: number }> | null;
                                    };
                                } | null;
                                reviewRequests: {
                                    nodes: Array<{
                                        requestedReviewer:
                                            | { slug: string; name: string }
                                            | { login: string }
                                            | Record<PropertyKey, never>
                                            | null;
                                    } | null> | null;
                                } | null;
                                latestOpinionatedReviews: {
                                    nodes: Array<{
                                        state: PullRequestReviewState;
                                        author:
                                            | { login: string }
                                            | { login: string }
                                            | { login: string }
                                            | { login: string }
                                            | { login: string }
                                            | null;
                                    } | null> | null;
                                } | null;
                            }
                          | null;
                      fieldValues: {
                          nodes: Array<
                              | {
                                    __typename: 'ProjectV2ItemFieldDateValue';
                                    date: string | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldIterationValue';
                                    iterationId: string;
                                    title: string;
                                    startDate: string;
                                    duration: number;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldLabelValue' }
                              | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
                              | {
                                    __typename: 'ProjectV2ItemFieldMultiSelectValue';
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                    options: Array<{
                                        id: string;
                                        name: string;
                                        color: ProjectV2SingleSelectFieldOptionColor;
                                    }> | null;
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldNumberValue';
                                    number: number | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
                              | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
                              | { __typename: 'ProjectV2ItemFieldReviewerValue' }
                              | {
                                    __typename: 'ProjectV2ItemFieldSingleSelectValue';
                                    optionId: string | null;
                                    name: string | null;
                                    color: ProjectV2SingleSelectFieldOptionColor;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | {
                                    __typename: 'ProjectV2ItemFieldTextValue';
                                    text: string | null;
                                    field: { id: string } | { id: string } | { id: string } | { id: string };
                                }
                              | { __typename: 'ProjectV2ItemFieldUserValue' }
                              | { __typename: 'ProjectV2ItemIssueFieldValue' }
                              | null
                          > | null;
                      };
                  } | null> | null;
              };
          }
        | Record<PropertyKey, never>
        | null;
};

export type ProjectSchemaQueryVariables = Exact<{
    id: string;
}>;

export type ProjectSchemaQuery = {
    node:
        | {
              title: string;
              closed: boolean;
              viewerCanUpdate: boolean;
              fields: {
                  nodes: Array<
                      | { id: string; name: string; dataType: ProjectV2FieldType }
                      | {
                            id: string;
                            name: string;
                            dataType: ProjectV2FieldType;
                            configuration: {
                                iterations: Array<{ id: string; title: string; startDate: string; duration: number }>;
                                completedIterations: Array<{
                                    id: string;
                                    title: string;
                                    startDate: string;
                                    duration: number;
                                }>;
                            };
                        }
                      | {
                            id: string;
                            name: string;
                            dataType: ProjectV2FieldType;
                            multiSelectOptions: Array<{
                                id: string;
                                name: string;
                                color: ProjectV2SingleSelectFieldOptionColor;
                            }>;
                        }
                      | {
                            id: string;
                            name: string;
                            dataType: ProjectV2FieldType;
                            options: Array<{ id: string; name: string; color: ProjectV2SingleSelectFieldOptionColor }>;
                        }
                      | null
                  > | null;
              };
              views: {
                  nodes: Array<{
                      id: string;
                      number: number;
                      name: string;
                      layout: ProjectV2ViewLayout;
                      filter: string | null;
                      groupByFields: {
                          nodes: Array<
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | null
                          > | null;
                      } | null;
                      verticalGroupByFields: {
                          nodes: Array<
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | null
                          > | null;
                      } | null;
                      sortByFields: {
                          nodes: Array<{
                              direction: OrderDirection;
                              field:
                                  | { id: string; name: string }
                                  | { id: string; name: string }
                                  | { id: string; name: string }
                                  | { id: string; name: string };
                          } | null> | null;
                      } | null;
                      fields: {
                          nodes: Array<
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | { id: string; name: string }
                              | null
                          > | null;
                      } | null;
                  } | null> | null;
              };
              items: { totalCount: number };
          }
        | Record<PropertyKey, never>
        | null;
};

export type ProjectUpdatedAtQueryVariables = Exact<{
    id: string;
}>;

export type ProjectUpdatedAtQuery = { node: { updatedAt: string } | Record<PropertyKey, never> | null };

export type PullRequestStacksQueryVariables = Exact<{
    ids: Array<string> | string;
    first: number;
}>;

export type PullRequestStacksQuery = {
    nodes: Array<
        | {
              id: string;
              entries: {
                  totalCount: number;
                  nodes: Array<{
                      pullRequest: {
                          __typename: 'PullRequest';
                          url: string;
                          number: number;
                          title: string;
                          createdAt: string;
                          closedAt: string | null;
                          additions: number;
                          deletions: number;
                          changedFiles: number;
                          headRefName: string;
                          baseRefName: string;
                          id: string;
                          updatedAt: string;
                          state: PullRequestState;
                          isDraft: boolean;
                          merged: boolean;
                          reviewDecision: PullRequestReviewDecision | null;
                          mergeable: MergeableState;
                          mergeStateStatus: MergeStateStatus;
                          baseRefOid: string;
                          author:
                              | { login: string; avatarUrl: string }
                              | { login: string; avatarUrl: string }
                              | { login: string; avatarUrl: string }
                              | { login: string; avatarUrl: string }
                              | { login: string; avatarUrl: string }
                              | null;
                          assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
                          labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
                          milestone: { title: string; dueOn: string | null } | null;
                          comments: { totalCount: number };
                          closingIssuesReferences: { nodes: Array<{ id: string } | null> | null } | null;
                          repository: {
                              nameWithOwner: string;
                              isPrivate: boolean;
                              viewerPermission: RepositoryPermission | null;
                              owner: { login: string } | { login: string };
                          };
                          projectItems: {
                              nodes: Array<{
                                  id: string;
                                  isArchived: boolean;
                                  updatedAt: string;
                                  project: { id: string; title: string; number: number; url: string };
                                  fieldValueByName:
                                      | {
                                            name: string | null;
                                            color: ProjectV2SingleSelectFieldOptionColor;
                                            optionId: string | null;
                                        }
                                      | Record<PropertyKey, never>
                                      | null;
                              } | null> | null;
                          } | null;
                          stack: { id: string; number: number; size: number } | null;
                          stackEntry: { position: number } | null;
                          baseRef: {
                              target: { oid: string } | { oid: string } | { oid: string } | { oid: string } | null;
                          } | null;
                          statusCheckRollup: {
                              state: StatusState;
                              contexts: {
                                  checkRunCountsByState: Array<{ state: CheckRunState; count: number }> | null;
                                  statusContextCountsByState: Array<{ state: StatusState; count: number }> | null;
                              };
                          } | null;
                          reviewRequests: {
                              nodes: Array<{
                                  requestedReviewer:
                                      | { slug: string; name: string }
                                      | { login: string }
                                      | Record<PropertyKey, never>
                                      | null;
                              } | null> | null;
                          } | null;
                          latestOpinionatedReviews: {
                              nodes: Array<{
                                  state: PullRequestReviewState;
                                  author:
                                      | { login: string }
                                      | { login: string }
                                      | { login: string }
                                      | { login: string }
                                      | { login: string }
                                      | null;
                              } | null> | null;
                          } | null;
                      } | null;
                  } | null> | null;
              };
          }
        | Record<PropertyKey, never>
        | null
    >;
};

export type PullRequestStatusesQueryVariables = Exact<{
    ids: Array<string> | string;
}>;

export type PullRequestStatusesQuery = {
    nodes: Array<
        | {
              __typename: 'PullRequest';
              id: string;
              updatedAt: string;
              state: PullRequestState;
              isDraft: boolean;
              merged: boolean;
              reviewDecision: PullRequestReviewDecision | null;
              mergeable: MergeableState;
              mergeStateStatus: MergeStateStatus;
              baseRefOid: string;
              stack: { id: string; number: number; size: number } | null;
              stackEntry: { position: number } | null;
              baseRef: { target: { oid: string } | { oid: string } | { oid: string } | { oid: string } | null } | null;
              statusCheckRollup: {
                  state: StatusState;
                  contexts: {
                      checkRunCountsByState: Array<{ state: CheckRunState; count: number }> | null;
                      statusContextCountsByState: Array<{ state: StatusState; count: number }> | null;
                  };
              } | null;
              reviewRequests: {
                  nodes: Array<{
                      requestedReviewer:
                          | { slug: string; name: string }
                          | { login: string }
                          | Record<PropertyKey, never>
                          | null;
                  } | null> | null;
              } | null;
              latestOpinionatedReviews: {
                  nodes: Array<{
                      state: PullRequestReviewState;
                      author:
                          | { login: string }
                          | { login: string }
                          | { login: string }
                          | { login: string }
                          | { login: string }
                          | null;
                  } | null> | null;
              } | null;
          }
        | Record<PropertyKey, never>
        | null
    >;
};

export type RepositoryAssignableUsersQueryVariables = Exact<{
    owner: string;
    name: string;
    after: string;
}>;

export type RepositoryAssignableUsersQuery = {
    repository: {
        assignableUsers: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{ id: string; login: string; name: string | null; avatarUrl: string } | null> | null;
        };
    } | null;
};

export type RepositoryForTrackingQueryVariables = Exact<{
    owner: string;
    name: string;
}>;

export type RepositoryForTrackingQuery = {
    repository: {
        id: string;
        nameWithOwner: string;
        isPrivate: boolean;
        isArchived: boolean;
        pushedAt: string | null;
        viewerPermission: RepositoryPermission | null;
        owner: { login: string } | { login: string };
        issues: { totalCount: number };
        pullRequests: { totalCount: number };
    } | null;
};

export type RepositoryIssueTemplatesQueryVariables = Exact<{
    owner: string;
    name: string;
}>;

export type RepositoryIssueTemplatesQuery = {
    repository: {
        nameWithOwner: string;
        isBlankIssuesEnabled: boolean;
        issueTemplates: Array<{
            name: string;
            filename: string;
            about: string | null;
            title: string | null;
            body: string | null;
            labels: { nodes: Array<{ name: string } | null> | null } | null;
            assignees: { nodes: Array<{ login: string } | null> | null };
            type: { name: string } | null;
        }> | null;
        templateFiles:
            | {
                  entries: Array<{
                      name: string;
                      object: { text: string | null; isTruncated: boolean } | Record<PropertyKey, never> | null;
                  }> | null;
              }
            | Record<PropertyKey, never>
            | null;
    } | null;
};

export type RepositoryIssuesQueryVariables = Exact<{
    owner: string;
    name: string;
    states: Array<IssueState> | IssueState;
    after?: string | null | undefined;
}>;

export type RepositoryIssuesQuery = {
    repository: {
        issues: {
            totalCount: number;
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{
                __typename: 'Issue';
                id: string;
                url: string;
                number: number;
                title: string;
                stateReason: IssueStateReason | null;
                createdAt: string;
                updatedAt: string;
                closedAt: string | null;
                issueState: IssueState;
                author:
                    | { login: string; avatarUrl: string }
                    | { login: string; avatarUrl: string }
                    | { login: string; avatarUrl: string }
                    | { login: string; avatarUrl: string }
                    | { login: string; avatarUrl: string }
                    | null;
                assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
                labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
                milestone: { title: string; dueOn: string | null } | null;
                issueType: { name: string; color: IssueTypeColor } | null;
                comments: { totalCount: number };
                subIssuesSummary: { total: number; completed: number };
                repository: {
                    nameWithOwner: string;
                    isPrivate: boolean;
                    viewerPermission: RepositoryPermission | null;
                    owner: { login: string } | { login: string };
                };
                projectItems: {
                    nodes: Array<{
                        id: string;
                        isArchived: boolean;
                        updatedAt: string;
                        project: { id: string; title: string; number: number; url: string };
                        fieldValueByName:
                            | {
                                  name: string | null;
                                  color: ProjectV2SingleSelectFieldOptionColor;
                                  optionId: string | null;
                              }
                            | Record<PropertyKey, never>
                            | null;
                    } | null> | null;
                } | null;
            } | null> | null;
        };
    } | null;
};

export type RepositoryLabelQueryVariables = Exact<{
    owner: string;
    name: string;
    label: string;
}>;

export type RepositoryLabelQuery = {
    repository: { label: { id: string; name: string; color: string; description: string | null } | null } | null;
};

export type RepositoryLabelsQueryVariables = Exact<{
    owner: string;
    name: string;
    after: string;
}>;

export type RepositoryLabelsQuery = {
    repository: {
        labels: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{ id: string; name: string; color: string; description: string | null } | null> | null;
        } | null;
    } | null;
};

export type RepositoryMetadataQueryVariables = Exact<{
    owner: string;
    name: string;
}>;

export type RepositoryMetadataQuery = {
    repository: {
        id: string;
        nameWithOwner: string;
        viewerPermission: RepositoryPermission | null;
        isArchived: boolean;
        hasIssuesEnabled: boolean;
        labels: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{ id: string; name: string; color: string; description: string | null } | null> | null;
        } | null;
        milestones: {
            totalCount: number;
            nodes: Array<{ id: string; title: string; dueOn: string | null } | null> | null;
        } | null;
        assignableUsers: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{ id: string; login: string; name: string | null; avatarUrl: string } | null> | null;
        };
        issueTypes: {
            nodes: Array<{
                id: string;
                name: string;
                color: IssueTypeColor;
                description: string | null;
                isEnabled: boolean;
            } | null> | null;
        } | null;
    } | null;
};

export type RepositoryPullRequestsQueryVariables = Exact<{
    owner: string;
    name: string;
    states: Array<PullRequestState> | PullRequestState;
    first: number;
    after?: string | null | undefined;
}>;

export type RepositoryPullRequestsQuery = {
    repository: {
        pullRequests: {
            totalCount: number;
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{
                __typename: 'PullRequest';
                url: string;
                number: number;
                title: string;
                createdAt: string;
                closedAt: string | null;
                additions: number;
                deletions: number;
                changedFiles: number;
                headRefName: string;
                baseRefName: string;
                id: string;
                updatedAt: string;
                state: PullRequestState;
                isDraft: boolean;
                merged: boolean;
                reviewDecision: PullRequestReviewDecision | null;
                mergeable: MergeableState;
                mergeStateStatus: MergeStateStatus;
                baseRefOid: string;
                author:
                    | { login: string; avatarUrl: string }
                    | { login: string; avatarUrl: string }
                    | { login: string; avatarUrl: string }
                    | { login: string; avatarUrl: string }
                    | { login: string; avatarUrl: string }
                    | null;
                assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
                labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
                milestone: { title: string; dueOn: string | null } | null;
                comments: { totalCount: number };
                closingIssuesReferences: { nodes: Array<{ id: string } | null> | null } | null;
                repository: {
                    nameWithOwner: string;
                    isPrivate: boolean;
                    viewerPermission: RepositoryPermission | null;
                    owner: { login: string } | { login: string };
                };
                projectItems: {
                    nodes: Array<{
                        id: string;
                        isArchived: boolean;
                        updatedAt: string;
                        project: { id: string; title: string; number: number; url: string };
                        fieldValueByName:
                            | {
                                  name: string | null;
                                  color: ProjectV2SingleSelectFieldOptionColor;
                                  optionId: string | null;
                              }
                            | Record<PropertyKey, never>
                            | null;
                    } | null> | null;
                } | null;
                stack: { id: string; number: number; size: number } | null;
                stackEntry: { position: number } | null;
                baseRef: {
                    target: { oid: string } | { oid: string } | { oid: string } | { oid: string } | null;
                } | null;
                statusCheckRollup: {
                    state: StatusState;
                    contexts: {
                        checkRunCountsByState: Array<{ state: CheckRunState; count: number }> | null;
                        statusContextCountsByState: Array<{ state: StatusState; count: number }> | null;
                    };
                } | null;
                reviewRequests: {
                    nodes: Array<{
                        requestedReviewer:
                            | { slug: string; name: string }
                            | { login: string }
                            | Record<PropertyKey, never>
                            | null;
                    } | null> | null;
                } | null;
                latestOpinionatedReviews: {
                    nodes: Array<{
                        state: PullRequestReviewState;
                        author:
                            | { login: string }
                            | { login: string }
                            | { login: string }
                            | { login: string }
                            | { login: string }
                            | null;
                    } | null> | null;
                } | null;
            } | null> | null;
        };
    } | null;
};

export type RepositorySearchQueryVariables = Exact<{
    query: string;
}>;

export type RepositorySearchQuery = {
    search: {
        nodes: Array<
            | {
                  nameWithOwner: string;
                  isPrivate: boolean;
                  isArchived: boolean;
                  hasIssuesEnabled: boolean;
                  viewerPermission: RepositoryPermission | null;
                  pushedAt: string | null;
              }
            | Record<PropertyKey, never>
            | null
        > | null;
    };
};

export type TrackingCandidatesQueryVariables = Exact<{ [key: string]: never }>;

export type TrackingCandidatesQuery = {
    viewer: {
        login: string;
        repositories: {
            totalCount: number;
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{
                id: string;
                nameWithOwner: string;
                isPrivate: boolean;
                isArchived: boolean;
                pushedAt: string | null;
                viewerPermission: RepositoryPermission | null;
                owner: { login: string } | { login: string };
                issues: { totalCount: number };
                pullRequests: { totalCount: number };
            } | null> | null;
        };
        organizations: {
            nodes: Array<{
                login: string;
                avatarUrl: string;
                repositories: {
                    totalCount: number;
                    pageInfo: { hasNextPage: boolean; endCursor: string | null };
                    nodes: Array<{
                        id: string;
                        nameWithOwner: string;
                        isPrivate: boolean;
                        isArchived: boolean;
                        pushedAt: string | null;
                        viewerPermission: RepositoryPermission | null;
                        owner: { login: string } | { login: string };
                        issues: { totalCount: number };
                        pullRequests: { totalCount: number };
                    } | null> | null;
                };
            } | null> | null;
        };
    };
};

export type TrackingProjectsQueryVariables = Exact<{ [key: string]: never }>;

export type TrackingProjectsQuery = {
    viewer: {
        projectsV2: {
            totalCount: number;
            nodes: Array<{
                id: string;
                title: string;
                number: number;
                url: string;
                closed: boolean;
                updatedAt: string;
                items: { totalCount: number };
                owner:
                    | { __typename: 'Issue' }
                    | { __typename: 'Organization'; login: string }
                    | { __typename: 'PullRequest' }
                    | { __typename: 'User'; login: string };
            } | null> | null;
        };
        organizations: {
            nodes: Array<{
                login: string;
                projectsV2: {
                    totalCount: number;
                    nodes: Array<{
                        id: string;
                        title: string;
                        number: number;
                        url: string;
                        closed: boolean;
                        updatedAt: string;
                        items: { totalCount: number };
                        owner:
                            | { __typename: 'Issue' }
                            | { __typename: 'Organization'; login: string }
                            | { __typename: 'PullRequest' }
                            | { __typename: 'User'; login: string };
                    } | null> | null;
                };
            } | null> | null;
        };
    };
};

export type UserByLoginQueryVariables = Exact<{
    login: string;
}>;

export type UserByLoginQuery = { user: { id: string; login: string; name: string | null; avatarUrl: string } | null };

export type ViewerQueryVariables = Exact<{ [key: string]: never }>;

export type ViewerQuery = { viewer: { login: string; name: string | null; avatarUrl: string } };

export type ViewerProjectsQueryVariables = Exact<{ [key: string]: never }>;

export type ViewerProjectsQuery = {
    viewer: {
        projectsV2: {
            nodes: Array<{ id: string; title: string; number: number; url: string; closed: boolean } | null> | null;
        };
        organizations: {
            nodes: Array<{
                login: string;
                projectsV2: {
                    nodes: Array<{
                        id: string;
                        title: string;
                        number: number;
                        url: string;
                        closed: boolean;
                    } | null> | null;
                };
            } | null> | null;
        };
    };
};

export type ViewerRepositoriesQueryVariables = Exact<{
    after: string;
}>;

export type ViewerRepositoriesQuery = {
    viewer: {
        repositories: {
            totalCount: number;
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{
                id: string;
                nameWithOwner: string;
                isPrivate: boolean;
                isArchived: boolean;
                pushedAt: string | null;
                viewerPermission: RepositoryPermission | null;
                owner: { login: string } | { login: string };
                issues: { totalCount: number };
                pullRequests: { totalCount: number };
            } | null> | null;
        };
    };
};

type AssignableResultFields_Issue_Fragment = {
    __typename: 'Issue';
    id: string;
    updatedAt: string;
    assignees: { nodes: Array<{ id: string; login: string; avatarUrl: string } | null> | null };
};

type AssignableResultFields_PullRequest_Fragment = {
    __typename: 'PullRequest';
    id: string;
    updatedAt: string;
    assignees: { nodes: Array<{ id: string; login: string; avatarUrl: string } | null> | null };
};

export type AssignableResultFieldsFragment =
    | AssignableResultFields_Issue_Fragment
    | AssignableResultFields_PullRequest_Fragment;

export type CommentPageFieldsFragment = {
    totalCount: number;
    pageInfo: { hasPreviousPage: boolean; startCursor: string | null };
    nodes: Array<{
        id: string;
        url: string;
        createdAt: string;
        lastEditedAt: string | null;
        bodyHTML: string;
        author:
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | { login: string; avatarUrl: string }
            | null;
    } | null> | null;
};

export type DraftIssueFieldsFragment = {
    __typename: 'DraftIssue';
    id: string;
    title: string;
    body: string;
    createdAt: string;
    updatedAt: string;
    creator:
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | null;
    assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
};

export type IssueCommentFieldsFragment = {
    id: string;
    url: string;
    createdAt: string;
    lastEditedAt: string | null;
    bodyHTML: string;
    author:
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | null;
};

export type IssueDetailFieldsFragment = {
    __typename: 'Issue';
    body: string;
    bodyHTML: string;
    id: string;
    url: string;
    number: number;
    title: string;
    stateReason: IssueStateReason | null;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
    issueState: IssueState;
    reactionGroups: Array<{
        content: ReactionContent;
        viewerHasReacted: boolean;
        reactors: { totalCount: number };
    }> | null;
    commentPage: {
        totalCount: number;
        pageInfo: { hasPreviousPage: boolean; startCursor: string | null };
        nodes: Array<{
            id: string;
            url: string;
            createdAt: string;
            lastEditedAt: string | null;
            bodyHTML: string;
            author:
                | { login: string; avatarUrl: string }
                | { login: string; avatarUrl: string }
                | { login: string; avatarUrl: string }
                | { login: string; avatarUrl: string }
                | { login: string; avatarUrl: string }
                | null;
        } | null> | null;
    };
    parent: {
        id: string;
        url: string;
        number: number;
        title: string;
        state: IssueState;
        stateReason: IssueStateReason | null;
        repository: { nameWithOwner: string };
    } | null;
    subIssues: {
        totalCount: number;
        nodes: Array<{
            id: string;
            url: string;
            number: number;
            title: string;
            state: IssueState;
            stateReason: IssueStateReason | null;
            repository: { nameWithOwner: string };
        } | null> | null;
    };
    blockedBy: {
        totalCount: number;
        nodes: Array<{
            id: string;
            url: string;
            number: number;
            title: string;
            state: IssueState;
            stateReason: IssueStateReason | null;
            repository: { nameWithOwner: string };
        } | null> | null;
    };
    blocking: {
        totalCount: number;
        nodes: Array<{
            id: string;
            url: string;
            number: number;
            title: string;
            state: IssueState;
            stateReason: IssueStateReason | null;
            repository: { nameWithOwner: string };
        } | null> | null;
    };
    projectItems: {
        nodes: Array<{
            id: string;
            isArchived: boolean;
            updatedAt: string;
            project: {
                viewerCanUpdate: boolean;
                id: string;
                title: string;
                number: number;
                url: string;
                fields: {
                    nodes: Array<
                        | { id: string; name: string; dataType: ProjectV2FieldType }
                        | {
                              id: string;
                              name: string;
                              dataType: ProjectV2FieldType;
                              configuration: {
                                  iterations: Array<{ id: string; title: string; startDate: string; duration: number }>;
                                  completedIterations: Array<{
                                      id: string;
                                      title: string;
                                      startDate: string;
                                      duration: number;
                                  }>;
                              };
                          }
                        | {
                              id: string;
                              name: string;
                              dataType: ProjectV2FieldType;
                              multiSelectOptions: Array<{
                                  id: string;
                                  name: string;
                                  color: ProjectV2SingleSelectFieldOptionColor;
                              }>;
                          }
                        | {
                              id: string;
                              name: string;
                              dataType: ProjectV2FieldType;
                              options: Array<{
                                  id: string;
                                  name: string;
                                  color: ProjectV2SingleSelectFieldOptionColor;
                              }>;
                          }
                        | null
                    > | null;
                };
            };
            fieldValueByName:
                | { name: string | null; color: ProjectV2SingleSelectFieldOptionColor; optionId: string | null }
                | Record<PropertyKey, never>
                | null;
            fieldValues: {
                nodes: Array<
                    | {
                          __typename: 'ProjectV2ItemFieldDateValue';
                          date: string | null;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | {
                          __typename: 'ProjectV2ItemFieldIterationValue';
                          iterationId: string;
                          title: string;
                          startDate: string;
                          duration: number;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | { __typename: 'ProjectV2ItemFieldLabelValue' }
                    | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
                    | {
                          __typename: 'ProjectV2ItemFieldMultiSelectValue';
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                          options: Array<{
                              id: string;
                              name: string;
                              color: ProjectV2SingleSelectFieldOptionColor;
                          }> | null;
                      }
                    | {
                          __typename: 'ProjectV2ItemFieldNumberValue';
                          number: number | null;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
                    | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
                    | { __typename: 'ProjectV2ItemFieldReviewerValue' }
                    | {
                          __typename: 'ProjectV2ItemFieldSingleSelectValue';
                          optionId: string | null;
                          name: string | null;
                          color: ProjectV2SingleSelectFieldOptionColor;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | {
                          __typename: 'ProjectV2ItemFieldTextValue';
                          text: string | null;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | { __typename: 'ProjectV2ItemFieldUserValue' }
                    | { __typename: 'ProjectV2ItemIssueFieldValue' }
                    | null
                > | null;
            };
        } | null> | null;
    } | null;
    author:
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | null;
    assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
    labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
    milestone: { title: string; dueOn: string | null } | null;
    issueType: { name: string; color: IssueTypeColor } | null;
    comments: { totalCount: number };
    subIssuesSummary: { total: number; completed: number };
    repository: {
        nameWithOwner: string;
        isPrivate: boolean;
        viewerPermission: RepositoryPermission | null;
        owner: { login: string } | { login: string };
    };
};

export type IssueFieldsFragment = {
    __typename: 'Issue';
    id: string;
    url: string;
    number: number;
    title: string;
    stateReason: IssueStateReason | null;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
    issueState: IssueState;
    author:
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | null;
    assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
    labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
    milestone: { title: string; dueOn: string | null } | null;
    issueType: { name: string; color: IssueTypeColor } | null;
    comments: { totalCount: number };
    subIssuesSummary: { total: number; completed: number };
    repository: {
        nameWithOwner: string;
        isPrivate: boolean;
        viewerPermission: RepositoryPermission | null;
        owner: { login: string } | { login: string };
    };
    projectItems: {
        nodes: Array<{
            id: string;
            isArchived: boolean;
            updatedAt: string;
            project: { id: string; title: string; number: number; url: string };
            fieldValueByName:
                | { name: string | null; color: ProjectV2SingleSelectFieldOptionColor; optionId: string | null }
                | Record<PropertyKey, never>
                | null;
        } | null> | null;
    } | null;
};

export type IssueStateResultFieldsFragment = {
    id: string;
    updatedAt: string;
    state: IssueState;
    stateReason: IssueStateReason | null;
    closedAt: string | null;
};

export type ItemProjectItemFieldsFragment = {
    id: string;
    isArchived: boolean;
    updatedAt: string;
    project: { id: string; title: string; number: number; url: string };
    fieldValueByName:
        | { name: string | null; color: ProjectV2SingleSelectFieldOptionColor; optionId: string | null }
        | Record<PropertyKey, never>
        | null;
};

export type ItemRepositoryFieldsFragment = {
    nameWithOwner: string;
    isPrivate: boolean;
    viewerPermission: RepositoryPermission | null;
    owner: { login: string } | { login: string };
};

type LabelableResultFields_Discussion_Fragment = {
    labels: { nodes: Array<{ id: string; name: string; color: string } | null> | null } | null;
};

type LabelableResultFields_Issue_Fragment = {
    __typename: 'Issue';
    id: string;
    updatedAt: string;
    labels: { nodes: Array<{ id: string; name: string; color: string } | null> | null } | null;
};

type LabelableResultFields_PullRequest_Fragment = {
    __typename: 'PullRequest';
    id: string;
    updatedAt: string;
    labels: { nodes: Array<{ id: string; name: string; color: string } | null> | null } | null;
};

export type LabelableResultFieldsFragment =
    | LabelableResultFields_Discussion_Fragment
    | LabelableResultFields_Issue_Fragment
    | LabelableResultFields_PullRequest_Fragment;

export type LinkedIssueFieldsFragment = {
    id: string;
    url: string;
    number: number;
    title: string;
    state: IssueState;
    stateReason: IssueStateReason | null;
    repository: { nameWithOwner: string };
};

export type MilestoneResultFieldsFragment = { id: string; title: string; dueOn: string | null };

type ProjectFieldFields_ProjectV2Field_Fragment = { id: string; name: string; dataType: ProjectV2FieldType };

type ProjectFieldFields_ProjectV2IterationField_Fragment = {
    id: string;
    name: string;
    dataType: ProjectV2FieldType;
    configuration: {
        iterations: Array<{ id: string; title: string; startDate: string; duration: number }>;
        completedIterations: Array<{ id: string; title: string; startDate: string; duration: number }>;
    };
};

type ProjectFieldFields_ProjectV2MultiSelectField_Fragment = {
    id: string;
    name: string;
    dataType: ProjectV2FieldType;
    multiSelectOptions: Array<{ id: string; name: string; color: ProjectV2SingleSelectFieldOptionColor }>;
};

type ProjectFieldFields_ProjectV2SingleSelectField_Fragment = {
    id: string;
    name: string;
    dataType: ProjectV2FieldType;
    options: Array<{ id: string; name: string; color: ProjectV2SingleSelectFieldOptionColor }>;
};

export type ProjectFieldFieldsFragment =
    | ProjectFieldFields_ProjectV2Field_Fragment
    | ProjectFieldFields_ProjectV2IterationField_Fragment
    | ProjectFieldFields_ProjectV2MultiSelectField_Fragment
    | ProjectFieldFields_ProjectV2SingleSelectField_Fragment;

type ProjectFieldIdFields_ProjectV2Field_Fragment = { id: string };

type ProjectFieldIdFields_ProjectV2IterationField_Fragment = { id: string };

type ProjectFieldIdFields_ProjectV2MultiSelectField_Fragment = { id: string };

type ProjectFieldIdFields_ProjectV2SingleSelectField_Fragment = { id: string };

export type ProjectFieldIdFieldsFragment =
    | ProjectFieldIdFields_ProjectV2Field_Fragment
    | ProjectFieldIdFields_ProjectV2IterationField_Fragment
    | ProjectFieldIdFields_ProjectV2MultiSelectField_Fragment
    | ProjectFieldIdFields_ProjectV2SingleSelectField_Fragment;

type ProjectFieldRefFields_ProjectV2Field_Fragment = { id: string; name: string };

type ProjectFieldRefFields_ProjectV2IterationField_Fragment = { id: string; name: string };

type ProjectFieldRefFields_ProjectV2MultiSelectField_Fragment = { id: string; name: string };

type ProjectFieldRefFields_ProjectV2SingleSelectField_Fragment = { id: string; name: string };

export type ProjectFieldRefFieldsFragment =
    | ProjectFieldRefFields_ProjectV2Field_Fragment
    | ProjectFieldRefFields_ProjectV2IterationField_Fragment
    | ProjectFieldRefFields_ProjectV2MultiSelectField_Fragment
    | ProjectFieldRefFields_ProjectV2SingleSelectField_Fragment;

export type ProjectItemDetailFieldsFragment = {
    id: string;
    isArchived: boolean;
    updatedAt: string;
    project: {
        viewerCanUpdate: boolean;
        id: string;
        title: string;
        number: number;
        url: string;
        fields: {
            nodes: Array<
                | { id: string; name: string; dataType: ProjectV2FieldType }
                | {
                      id: string;
                      name: string;
                      dataType: ProjectV2FieldType;
                      configuration: {
                          iterations: Array<{ id: string; title: string; startDate: string; duration: number }>;
                          completedIterations: Array<{
                              id: string;
                              title: string;
                              startDate: string;
                              duration: number;
                          }>;
                      };
                  }
                | {
                      id: string;
                      name: string;
                      dataType: ProjectV2FieldType;
                      multiSelectOptions: Array<{
                          id: string;
                          name: string;
                          color: ProjectV2SingleSelectFieldOptionColor;
                      }>;
                  }
                | {
                      id: string;
                      name: string;
                      dataType: ProjectV2FieldType;
                      options: Array<{ id: string; name: string; color: ProjectV2SingleSelectFieldOptionColor }>;
                  }
                | null
            > | null;
        };
    };
    fieldValueByName:
        | { name: string | null; color: ProjectV2SingleSelectFieldOptionColor; optionId: string | null }
        | Record<PropertyKey, never>
        | null;
    fieldValues: {
        nodes: Array<
            | {
                  __typename: 'ProjectV2ItemFieldDateValue';
                  date: string | null;
                  field: { id: string } | { id: string } | { id: string } | { id: string };
              }
            | {
                  __typename: 'ProjectV2ItemFieldIterationValue';
                  iterationId: string;
                  title: string;
                  startDate: string;
                  duration: number;
                  field: { id: string } | { id: string } | { id: string } | { id: string };
              }
            | { __typename: 'ProjectV2ItemFieldLabelValue' }
            | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
            | {
                  __typename: 'ProjectV2ItemFieldMultiSelectValue';
                  field: { id: string } | { id: string } | { id: string } | { id: string };
                  options: Array<{ id: string; name: string; color: ProjectV2SingleSelectFieldOptionColor }> | null;
              }
            | {
                  __typename: 'ProjectV2ItemFieldNumberValue';
                  number: number | null;
                  field: { id: string } | { id: string } | { id: string } | { id: string };
              }
            | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
            | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
            | { __typename: 'ProjectV2ItemFieldReviewerValue' }
            | {
                  __typename: 'ProjectV2ItemFieldSingleSelectValue';
                  optionId: string | null;
                  name: string | null;
                  color: ProjectV2SingleSelectFieldOptionColor;
                  field: { id: string } | { id: string } | { id: string } | { id: string };
              }
            | {
                  __typename: 'ProjectV2ItemFieldTextValue';
                  text: string | null;
                  field: { id: string } | { id: string } | { id: string } | { id: string };
              }
            | { __typename: 'ProjectV2ItemFieldUserValue' }
            | { __typename: 'ProjectV2ItemIssueFieldValue' }
            | null
        > | null;
    };
};

export type ProjectItemFieldResultFieldsFragment = {
    id: string;
    updatedAt: string;
    fieldValueByName:
        | {
              __typename: 'ProjectV2ItemFieldDateValue';
              date: string | null;
              field: { id: string } | { id: string } | { id: string } | { id: string };
          }
        | {
              __typename: 'ProjectV2ItemFieldIterationValue';
              iterationId: string;
              title: string;
              startDate: string;
              duration: number;
              field: { id: string } | { id: string } | { id: string } | { id: string };
          }
        | { __typename: 'ProjectV2ItemFieldLabelValue' }
        | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
        | {
              __typename: 'ProjectV2ItemFieldMultiSelectValue';
              field: { id: string } | { id: string } | { id: string } | { id: string };
              options: Array<{ id: string; name: string; color: ProjectV2SingleSelectFieldOptionColor }> | null;
          }
        | {
              __typename: 'ProjectV2ItemFieldNumberValue';
              number: number | null;
              field: { id: string } | { id: string } | { id: string } | { id: string };
          }
        | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
        | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
        | { __typename: 'ProjectV2ItemFieldReviewerValue' }
        | {
              __typename: 'ProjectV2ItemFieldSingleSelectValue';
              optionId: string | null;
              name: string | null;
              color: ProjectV2SingleSelectFieldOptionColor;
              field: { id: string } | { id: string } | { id: string } | { id: string };
          }
        | {
              __typename: 'ProjectV2ItemFieldTextValue';
              text: string | null;
              field: { id: string } | { id: string } | { id: string } | { id: string };
          }
        | { __typename: 'ProjectV2ItemFieldUserValue' }
        | { __typename: 'ProjectV2ItemIssueFieldValue' }
        | null;
};

type ProjectItemFieldValueFields_ProjectV2ItemFieldDateValue_Fragment = {
    __typename: 'ProjectV2ItemFieldDateValue';
    date: string | null;
    field: { id: string } | { id: string } | { id: string } | { id: string };
};

type ProjectItemFieldValueFields_ProjectV2ItemFieldIterationValue_Fragment = {
    __typename: 'ProjectV2ItemFieldIterationValue';
    iterationId: string;
    title: string;
    startDate: string;
    duration: number;
    field: { id: string } | { id: string } | { id: string } | { id: string };
};

type ProjectItemFieldValueFields_ProjectV2ItemFieldLabelValue_Fragment = { __typename: 'ProjectV2ItemFieldLabelValue' };

type ProjectItemFieldValueFields_ProjectV2ItemFieldMilestoneValue_Fragment = {
    __typename: 'ProjectV2ItemFieldMilestoneValue';
};

type ProjectItemFieldValueFields_ProjectV2ItemFieldMultiSelectValue_Fragment = {
    __typename: 'ProjectV2ItemFieldMultiSelectValue';
    field: { id: string } | { id: string } | { id: string } | { id: string };
    options: Array<{ id: string; name: string; color: ProjectV2SingleSelectFieldOptionColor }> | null;
};

type ProjectItemFieldValueFields_ProjectV2ItemFieldNumberValue_Fragment = {
    __typename: 'ProjectV2ItemFieldNumberValue';
    number: number | null;
    field: { id: string } | { id: string } | { id: string } | { id: string };
};

type ProjectItemFieldValueFields_ProjectV2ItemFieldPullRequestValue_Fragment = {
    __typename: 'ProjectV2ItemFieldPullRequestValue';
};

type ProjectItemFieldValueFields_ProjectV2ItemFieldRepositoryValue_Fragment = {
    __typename: 'ProjectV2ItemFieldRepositoryValue';
};

type ProjectItemFieldValueFields_ProjectV2ItemFieldReviewerValue_Fragment = {
    __typename: 'ProjectV2ItemFieldReviewerValue';
};

type ProjectItemFieldValueFields_ProjectV2ItemFieldSingleSelectValue_Fragment = {
    __typename: 'ProjectV2ItemFieldSingleSelectValue';
    optionId: string | null;
    name: string | null;
    color: ProjectV2SingleSelectFieldOptionColor;
    field: { id: string } | { id: string } | { id: string } | { id: string };
};

type ProjectItemFieldValueFields_ProjectV2ItemFieldTextValue_Fragment = {
    __typename: 'ProjectV2ItemFieldTextValue';
    text: string | null;
    field: { id: string } | { id: string } | { id: string } | { id: string };
};

type ProjectItemFieldValueFields_ProjectV2ItemFieldUserValue_Fragment = { __typename: 'ProjectV2ItemFieldUserValue' };

type ProjectItemFieldValueFields_ProjectV2ItemIssueFieldValue_Fragment = { __typename: 'ProjectV2ItemIssueFieldValue' };

export type ProjectItemFieldValueFieldsFragment =
    | ProjectItemFieldValueFields_ProjectV2ItemFieldDateValue_Fragment
    | ProjectItemFieldValueFields_ProjectV2ItemFieldIterationValue_Fragment
    | ProjectItemFieldValueFields_ProjectV2ItemFieldLabelValue_Fragment
    | ProjectItemFieldValueFields_ProjectV2ItemFieldMilestoneValue_Fragment
    | ProjectItemFieldValueFields_ProjectV2ItemFieldMultiSelectValue_Fragment
    | ProjectItemFieldValueFields_ProjectV2ItemFieldNumberValue_Fragment
    | ProjectItemFieldValueFields_ProjectV2ItemFieldPullRequestValue_Fragment
    | ProjectItemFieldValueFields_ProjectV2ItemFieldRepositoryValue_Fragment
    | ProjectItemFieldValueFields_ProjectV2ItemFieldReviewerValue_Fragment
    | ProjectItemFieldValueFields_ProjectV2ItemFieldSingleSelectValue_Fragment
    | ProjectItemFieldValueFields_ProjectV2ItemFieldTextValue_Fragment
    | ProjectItemFieldValueFields_ProjectV2ItemFieldUserValue_Fragment
    | ProjectItemFieldValueFields_ProjectV2ItemIssueFieldValue_Fragment;

export type ProjectItemPageFieldsFragment = {
    totalCount: number;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: Array<{
        isArchived: boolean;
        type: ProjectV2ItemType;
        id: string;
        updatedAt: string;
        content:
            | {
                  __typename: 'DraftIssue';
                  id: string;
                  title: string;
                  body: string;
                  createdAt: string;
                  updatedAt: string;
                  creator:
                      | { login: string; avatarUrl: string }
                      | { login: string; avatarUrl: string }
                      | { login: string; avatarUrl: string }
                      | { login: string; avatarUrl: string }
                      | { login: string; avatarUrl: string }
                      | null;
                  assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
              }
            | {
                  __typename: 'Issue';
                  id: string;
                  url: string;
                  number: number;
                  title: string;
                  stateReason: IssueStateReason | null;
                  createdAt: string;
                  updatedAt: string;
                  closedAt: string | null;
                  issueState: IssueState;
                  author:
                      | { login: string; avatarUrl: string }
                      | { login: string; avatarUrl: string }
                      | { login: string; avatarUrl: string }
                      | { login: string; avatarUrl: string }
                      | { login: string; avatarUrl: string }
                      | null;
                  assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
                  labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
                  milestone: { title: string; dueOn: string | null } | null;
                  issueType: { name: string; color: IssueTypeColor } | null;
                  comments: { totalCount: number };
                  subIssuesSummary: { total: number; completed: number };
                  repository: {
                      nameWithOwner: string;
                      isPrivate: boolean;
                      viewerPermission: RepositoryPermission | null;
                      owner: { login: string } | { login: string };
                  };
                  projectItems: {
                      nodes: Array<{
                          id: string;
                          isArchived: boolean;
                          updatedAt: string;
                          project: { id: string; title: string; number: number; url: string };
                          fieldValueByName:
                              | {
                                    name: string | null;
                                    color: ProjectV2SingleSelectFieldOptionColor;
                                    optionId: string | null;
                                }
                              | Record<PropertyKey, never>
                              | null;
                      } | null> | null;
                  } | null;
              }
            | {
                  __typename: 'PullRequest';
                  url: string;
                  number: number;
                  title: string;
                  createdAt: string;
                  closedAt: string | null;
                  additions: number;
                  deletions: number;
                  changedFiles: number;
                  headRefName: string;
                  baseRefName: string;
                  id: string;
                  updatedAt: string;
                  state: PullRequestState;
                  isDraft: boolean;
                  merged: boolean;
                  reviewDecision: PullRequestReviewDecision | null;
                  mergeable: MergeableState;
                  mergeStateStatus: MergeStateStatus;
                  baseRefOid: string;
                  author:
                      | { login: string; avatarUrl: string }
                      | { login: string; avatarUrl: string }
                      | { login: string; avatarUrl: string }
                      | { login: string; avatarUrl: string }
                      | { login: string; avatarUrl: string }
                      | null;
                  assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
                  labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
                  milestone: { title: string; dueOn: string | null } | null;
                  comments: { totalCount: number };
                  closingIssuesReferences: { nodes: Array<{ id: string } | null> | null } | null;
                  repository: {
                      nameWithOwner: string;
                      isPrivate: boolean;
                      viewerPermission: RepositoryPermission | null;
                      owner: { login: string } | { login: string };
                  };
                  projectItems: {
                      nodes: Array<{
                          id: string;
                          isArchived: boolean;
                          updatedAt: string;
                          project: { id: string; title: string; number: number; url: string };
                          fieldValueByName:
                              | {
                                    name: string | null;
                                    color: ProjectV2SingleSelectFieldOptionColor;
                                    optionId: string | null;
                                }
                              | Record<PropertyKey, never>
                              | null;
                      } | null> | null;
                  } | null;
                  stack: { id: string; number: number; size: number } | null;
                  stackEntry: { position: number } | null;
                  baseRef: {
                      target: { oid: string } | { oid: string } | { oid: string } | { oid: string } | null;
                  } | null;
                  statusCheckRollup: {
                      state: StatusState;
                      contexts: {
                          checkRunCountsByState: Array<{ state: CheckRunState; count: number }> | null;
                          statusContextCountsByState: Array<{ state: StatusState; count: number }> | null;
                      };
                  } | null;
                  reviewRequests: {
                      nodes: Array<{
                          requestedReviewer:
                              | { slug: string; name: string }
                              | { login: string }
                              | Record<PropertyKey, never>
                              | null;
                      } | null> | null;
                  } | null;
                  latestOpinionatedReviews: {
                      nodes: Array<{
                          state: PullRequestReviewState;
                          author:
                              | { login: string }
                              | { login: string }
                              | { login: string }
                              | { login: string }
                              | { login: string }
                              | null;
                      } | null> | null;
                  } | null;
              }
            | null;
        fieldValues: {
            nodes: Array<
                | {
                      __typename: 'ProjectV2ItemFieldDateValue';
                      date: string | null;
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                  }
                | {
                      __typename: 'ProjectV2ItemFieldIterationValue';
                      iterationId: string;
                      title: string;
                      startDate: string;
                      duration: number;
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                  }
                | { __typename: 'ProjectV2ItemFieldLabelValue' }
                | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
                | {
                      __typename: 'ProjectV2ItemFieldMultiSelectValue';
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                      options: Array<{ id: string; name: string; color: ProjectV2SingleSelectFieldOptionColor }> | null;
                  }
                | {
                      __typename: 'ProjectV2ItemFieldNumberValue';
                      number: number | null;
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                  }
                | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
                | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
                | { __typename: 'ProjectV2ItemFieldReviewerValue' }
                | {
                      __typename: 'ProjectV2ItemFieldSingleSelectValue';
                      optionId: string | null;
                      name: string | null;
                      color: ProjectV2SingleSelectFieldOptionColor;
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                  }
                | {
                      __typename: 'ProjectV2ItemFieldTextValue';
                      text: string | null;
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                  }
                | { __typename: 'ProjectV2ItemFieldUserValue' }
                | { __typename: 'ProjectV2ItemIssueFieldValue' }
                | null
            > | null;
        };
    } | null> | null;
};

export type ProjectItemRowFieldsFragment = {
    isArchived: boolean;
    type: ProjectV2ItemType;
    id: string;
    updatedAt: string;
    content:
        | {
              __typename: 'DraftIssue';
              id: string;
              title: string;
              body: string;
              createdAt: string;
              updatedAt: string;
              creator:
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | null;
              assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
          }
        | {
              __typename: 'Issue';
              id: string;
              url: string;
              number: number;
              title: string;
              stateReason: IssueStateReason | null;
              createdAt: string;
              updatedAt: string;
              closedAt: string | null;
              issueState: IssueState;
              author:
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | null;
              assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
              labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
              milestone: { title: string; dueOn: string | null } | null;
              issueType: { name: string; color: IssueTypeColor } | null;
              comments: { totalCount: number };
              subIssuesSummary: { total: number; completed: number };
              repository: {
                  nameWithOwner: string;
                  isPrivate: boolean;
                  viewerPermission: RepositoryPermission | null;
                  owner: { login: string } | { login: string };
              };
              projectItems: {
                  nodes: Array<{
                      id: string;
                      isArchived: boolean;
                      updatedAt: string;
                      project: { id: string; title: string; number: number; url: string };
                      fieldValueByName:
                          | {
                                name: string | null;
                                color: ProjectV2SingleSelectFieldOptionColor;
                                optionId: string | null;
                            }
                          | Record<PropertyKey, never>
                          | null;
                  } | null> | null;
              } | null;
          }
        | {
              __typename: 'PullRequest';
              url: string;
              number: number;
              title: string;
              createdAt: string;
              closedAt: string | null;
              additions: number;
              deletions: number;
              changedFiles: number;
              headRefName: string;
              baseRefName: string;
              id: string;
              updatedAt: string;
              state: PullRequestState;
              isDraft: boolean;
              merged: boolean;
              reviewDecision: PullRequestReviewDecision | null;
              mergeable: MergeableState;
              mergeStateStatus: MergeStateStatus;
              baseRefOid: string;
              author:
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | { login: string; avatarUrl: string }
                  | null;
              assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
              labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
              milestone: { title: string; dueOn: string | null } | null;
              comments: { totalCount: number };
              closingIssuesReferences: { nodes: Array<{ id: string } | null> | null } | null;
              repository: {
                  nameWithOwner: string;
                  isPrivate: boolean;
                  viewerPermission: RepositoryPermission | null;
                  owner: { login: string } | { login: string };
              };
              projectItems: {
                  nodes: Array<{
                      id: string;
                      isArchived: boolean;
                      updatedAt: string;
                      project: { id: string; title: string; number: number; url: string };
                      fieldValueByName:
                          | {
                                name: string | null;
                                color: ProjectV2SingleSelectFieldOptionColor;
                                optionId: string | null;
                            }
                          | Record<PropertyKey, never>
                          | null;
                  } | null> | null;
              } | null;
              stack: { id: string; number: number; size: number } | null;
              stackEntry: { position: number } | null;
              baseRef: { target: { oid: string } | { oid: string } | { oid: string } | { oid: string } | null } | null;
              statusCheckRollup: {
                  state: StatusState;
                  contexts: {
                      checkRunCountsByState: Array<{ state: CheckRunState; count: number }> | null;
                      statusContextCountsByState: Array<{ state: StatusState; count: number }> | null;
                  };
              } | null;
              reviewRequests: {
                  nodes: Array<{
                      requestedReviewer:
                          | { slug: string; name: string }
                          | { login: string }
                          | Record<PropertyKey, never>
                          | null;
                  } | null> | null;
              } | null;
              latestOpinionatedReviews: {
                  nodes: Array<{
                      state: PullRequestReviewState;
                      author:
                          | { login: string }
                          | { login: string }
                          | { login: string }
                          | { login: string }
                          | { login: string }
                          | null;
                  } | null> | null;
              } | null;
          }
        | null;
    fieldValues: {
        nodes: Array<
            | {
                  __typename: 'ProjectV2ItemFieldDateValue';
                  date: string | null;
                  field: { id: string } | { id: string } | { id: string } | { id: string };
              }
            | {
                  __typename: 'ProjectV2ItemFieldIterationValue';
                  iterationId: string;
                  title: string;
                  startDate: string;
                  duration: number;
                  field: { id: string } | { id: string } | { id: string } | { id: string };
              }
            | { __typename: 'ProjectV2ItemFieldLabelValue' }
            | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
            | {
                  __typename: 'ProjectV2ItemFieldMultiSelectValue';
                  field: { id: string } | { id: string } | { id: string } | { id: string };
                  options: Array<{ id: string; name: string; color: ProjectV2SingleSelectFieldOptionColor }> | null;
              }
            | {
                  __typename: 'ProjectV2ItemFieldNumberValue';
                  number: number | null;
                  field: { id: string } | { id: string } | { id: string } | { id: string };
              }
            | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
            | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
            | { __typename: 'ProjectV2ItemFieldReviewerValue' }
            | {
                  __typename: 'ProjectV2ItemFieldSingleSelectValue';
                  optionId: string | null;
                  name: string | null;
                  color: ProjectV2SingleSelectFieldOptionColor;
                  field: { id: string } | { id: string } | { id: string } | { id: string };
              }
            | {
                  __typename: 'ProjectV2ItemFieldTextValue';
                  text: string | null;
                  field: { id: string } | { id: string } | { id: string } | { id: string };
              }
            | { __typename: 'ProjectV2ItemFieldUserValue' }
            | { __typename: 'ProjectV2ItemIssueFieldValue' }
            | null
        > | null;
    };
};

export type ProjectItemValuesFieldsFragment = {
    id: string;
    updatedAt: string;
    fieldValues: {
        nodes: Array<
            | {
                  __typename: 'ProjectV2ItemFieldDateValue';
                  date: string | null;
                  field: { id: string } | { id: string } | { id: string } | { id: string };
              }
            | {
                  __typename: 'ProjectV2ItemFieldIterationValue';
                  iterationId: string;
                  title: string;
                  startDate: string;
                  duration: number;
                  field: { id: string } | { id: string } | { id: string } | { id: string };
              }
            | { __typename: 'ProjectV2ItemFieldLabelValue' }
            | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
            | {
                  __typename: 'ProjectV2ItemFieldMultiSelectValue';
                  field: { id: string } | { id: string } | { id: string } | { id: string };
                  options: Array<{ id: string; name: string; color: ProjectV2SingleSelectFieldOptionColor }> | null;
              }
            | {
                  __typename: 'ProjectV2ItemFieldNumberValue';
                  number: number | null;
                  field: { id: string } | { id: string } | { id: string } | { id: string };
              }
            | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
            | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
            | { __typename: 'ProjectV2ItemFieldReviewerValue' }
            | {
                  __typename: 'ProjectV2ItemFieldSingleSelectValue';
                  optionId: string | null;
                  name: string | null;
                  color: ProjectV2SingleSelectFieldOptionColor;
                  field: { id: string } | { id: string } | { id: string } | { id: string };
              }
            | {
                  __typename: 'ProjectV2ItemFieldTextValue';
                  text: string | null;
                  field: { id: string } | { id: string } | { id: string } | { id: string };
              }
            | { __typename: 'ProjectV2ItemFieldUserValue' }
            | { __typename: 'ProjectV2ItemIssueFieldValue' }
            | null
        > | null;
    };
};

export type ProjectIterationFieldsFragment = { id: string; title: string; startDate: string; duration: number };

export type ProjectViewFieldsFragment = {
    id: string;
    number: number;
    name: string;
    layout: ProjectV2ViewLayout;
    filter: string | null;
    groupByFields: {
        nodes: Array<
            | { id: string; name: string }
            | { id: string; name: string }
            | { id: string; name: string }
            | { id: string; name: string }
            | null
        > | null;
    } | null;
    verticalGroupByFields: {
        nodes: Array<
            | { id: string; name: string }
            | { id: string; name: string }
            | { id: string; name: string }
            | { id: string; name: string }
            | null
        > | null;
    } | null;
    sortByFields: {
        nodes: Array<{
            direction: OrderDirection;
            field:
                | { id: string; name: string }
                | { id: string; name: string }
                | { id: string; name: string }
                | { id: string; name: string };
        } | null> | null;
    } | null;
    fields: {
        nodes: Array<
            | { id: string; name: string }
            | { id: string; name: string }
            | { id: string; name: string }
            | { id: string; name: string }
            | null
        > | null;
    } | null;
};

export type PullRequestDetailFieldsFragment = {
    __typename: 'PullRequest';
    body: string;
    bodyHTML: string;
    url: string;
    number: number;
    title: string;
    createdAt: string;
    closedAt: string | null;
    additions: number;
    deletions: number;
    changedFiles: number;
    headRefName: string;
    baseRefName: string;
    id: string;
    updatedAt: string;
    state: PullRequestState;
    isDraft: boolean;
    merged: boolean;
    reviewDecision: PullRequestReviewDecision | null;
    mergeable: MergeableState;
    mergeStateStatus: MergeStateStatus;
    baseRefOid: string;
    reactionGroups: Array<{
        content: ReactionContent;
        viewerHasReacted: boolean;
        reactors: { totalCount: number };
    }> | null;
    commentPage: {
        totalCount: number;
        pageInfo: { hasPreviousPage: boolean; startCursor: string | null };
        nodes: Array<{
            id: string;
            url: string;
            createdAt: string;
            lastEditedAt: string | null;
            bodyHTML: string;
            author:
                | { login: string; avatarUrl: string }
                | { login: string; avatarUrl: string }
                | { login: string; avatarUrl: string }
                | { login: string; avatarUrl: string }
                | { login: string; avatarUrl: string }
                | null;
        } | null> | null;
    };
    commits: { totalCount: number };
    headRepository: { nameWithOwner: string } | null;
    statusCheckRollup: {
        state: StatusState;
        contextPage: {
            totalCount: number;
            nodes: Array<
                | {
                      __typename: 'CheckRun';
                      id: string;
                      name: string;
                      status: CheckStatusState;
                      conclusion: CheckConclusionState | null;
                      detailsUrl: string | null;
                      startedAt: string | null;
                      completedAt: string | null;
                      checkSuite: { workflowRun: { workflow: { name: string } } | null };
                  }
                | {
                      __typename: 'StatusContext';
                      id: string;
                      context: string;
                      state: StatusState;
                      targetUrl: string | null;
                      createdAt: string;
                  }
                | null
            > | null;
        };
        contexts: {
            checkRunCountsByState: Array<{ state: CheckRunState; count: number }> | null;
            statusContextCountsByState: Array<{ state: StatusState; count: number }> | null;
        };
    } | null;
    latestReviews: {
        nodes: Array<{
            state: PullRequestReviewState;
            submittedAt: string | null;
            author:
                | { login: string; avatarUrl: string }
                | { login: string; avatarUrl: string }
                | { login: string; avatarUrl: string }
                | { login: string; avatarUrl: string }
                | { login: string; avatarUrl: string }
                | null;
        } | null> | null;
    } | null;
    reviewRequests: {
        nodes: Array<{
            requestedReviewer:
                | { slug: string; name: string }
                | { avatarUrl: string; login: string }
                | Record<PropertyKey, never>
                | null;
        } | null> | null;
    } | null;
    projectItems: {
        nodes: Array<{
            id: string;
            isArchived: boolean;
            updatedAt: string;
            project: {
                viewerCanUpdate: boolean;
                id: string;
                title: string;
                number: number;
                url: string;
                fields: {
                    nodes: Array<
                        | { id: string; name: string; dataType: ProjectV2FieldType }
                        | {
                              id: string;
                              name: string;
                              dataType: ProjectV2FieldType;
                              configuration: {
                                  iterations: Array<{ id: string; title: string; startDate: string; duration: number }>;
                                  completedIterations: Array<{
                                      id: string;
                                      title: string;
                                      startDate: string;
                                      duration: number;
                                  }>;
                              };
                          }
                        | {
                              id: string;
                              name: string;
                              dataType: ProjectV2FieldType;
                              multiSelectOptions: Array<{
                                  id: string;
                                  name: string;
                                  color: ProjectV2SingleSelectFieldOptionColor;
                              }>;
                          }
                        | {
                              id: string;
                              name: string;
                              dataType: ProjectV2FieldType;
                              options: Array<{
                                  id: string;
                                  name: string;
                                  color: ProjectV2SingleSelectFieldOptionColor;
                              }>;
                          }
                        | null
                    > | null;
                };
            };
            fieldValueByName:
                | { name: string | null; color: ProjectV2SingleSelectFieldOptionColor; optionId: string | null }
                | Record<PropertyKey, never>
                | null;
            fieldValues: {
                nodes: Array<
                    | {
                          __typename: 'ProjectV2ItemFieldDateValue';
                          date: string | null;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | {
                          __typename: 'ProjectV2ItemFieldIterationValue';
                          iterationId: string;
                          title: string;
                          startDate: string;
                          duration: number;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | { __typename: 'ProjectV2ItemFieldLabelValue' }
                    | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
                    | {
                          __typename: 'ProjectV2ItemFieldMultiSelectValue';
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                          options: Array<{
                              id: string;
                              name: string;
                              color: ProjectV2SingleSelectFieldOptionColor;
                          }> | null;
                      }
                    | {
                          __typename: 'ProjectV2ItemFieldNumberValue';
                          number: number | null;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
                    | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
                    | { __typename: 'ProjectV2ItemFieldReviewerValue' }
                    | {
                          __typename: 'ProjectV2ItemFieldSingleSelectValue';
                          optionId: string | null;
                          name: string | null;
                          color: ProjectV2SingleSelectFieldOptionColor;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | {
                          __typename: 'ProjectV2ItemFieldTextValue';
                          text: string | null;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | { __typename: 'ProjectV2ItemFieldUserValue' }
                    | { __typename: 'ProjectV2ItemIssueFieldValue' }
                    | null
                > | null;
            };
        } | null> | null;
    } | null;
    author:
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | null;
    assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
    labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
    milestone: { title: string; dueOn: string | null } | null;
    comments: { totalCount: number };
    closingIssuesReferences: { nodes: Array<{ id: string } | null> | null } | null;
    repository: {
        nameWithOwner: string;
        isPrivate: boolean;
        viewerPermission: RepositoryPermission | null;
        owner: { login: string } | { login: string };
    };
    stack: { id: string; number: number; size: number } | null;
    stackEntry: { position: number } | null;
    baseRef: { target: { oid: string } | { oid: string } | { oid: string } | { oid: string } | null } | null;
    latestOpinionatedReviews: {
        nodes: Array<{
            state: PullRequestReviewState;
            author:
                | { login: string }
                | { login: string }
                | { login: string }
                | { login: string }
                | { login: string }
                | null;
        } | null> | null;
    } | null;
};

export type PullRequestFieldsFragment = {
    __typename: 'PullRequest';
    url: string;
    number: number;
    title: string;
    createdAt: string;
    closedAt: string | null;
    additions: number;
    deletions: number;
    changedFiles: number;
    headRefName: string;
    baseRefName: string;
    id: string;
    updatedAt: string;
    state: PullRequestState;
    isDraft: boolean;
    merged: boolean;
    reviewDecision: PullRequestReviewDecision | null;
    mergeable: MergeableState;
    mergeStateStatus: MergeStateStatus;
    baseRefOid: string;
    author:
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | { login: string; avatarUrl: string }
        | null;
    assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
    labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
    milestone: { title: string; dueOn: string | null } | null;
    comments: { totalCount: number };
    closingIssuesReferences: { nodes: Array<{ id: string } | null> | null } | null;
    repository: {
        nameWithOwner: string;
        isPrivate: boolean;
        viewerPermission: RepositoryPermission | null;
        owner: { login: string } | { login: string };
    };
    projectItems: {
        nodes: Array<{
            id: string;
            isArchived: boolean;
            updatedAt: string;
            project: { id: string; title: string; number: number; url: string };
            fieldValueByName:
                | { name: string | null; color: ProjectV2SingleSelectFieldOptionColor; optionId: string | null }
                | Record<PropertyKey, never>
                | null;
        } | null> | null;
    } | null;
    stack: { id: string; number: number; size: number } | null;
    stackEntry: { position: number } | null;
    baseRef: { target: { oid: string } | { oid: string } | { oid: string } | { oid: string } | null } | null;
    statusCheckRollup: {
        state: StatusState;
        contexts: {
            checkRunCountsByState: Array<{ state: CheckRunState; count: number }> | null;
            statusContextCountsByState: Array<{ state: StatusState; count: number }> | null;
        };
    } | null;
    reviewRequests: {
        nodes: Array<{
            requestedReviewer: { slug: string; name: string } | { login: string } | Record<PropertyKey, never> | null;
        } | null> | null;
    } | null;
    latestOpinionatedReviews: {
        nodes: Array<{
            state: PullRequestReviewState;
            author:
                | { login: string }
                | { login: string }
                | { login: string }
                | { login: string }
                | { login: string }
                | null;
        } | null> | null;
    } | null;
};

export type PullRequestStateResultFieldsFragment = {
    id: string;
    updatedAt: string;
    state: PullRequestState;
    isDraft: boolean;
    closedAt: string | null;
};

export type PullRequestStatusFieldsFragment = {
    __typename: 'PullRequest';
    id: string;
    updatedAt: string;
    state: PullRequestState;
    isDraft: boolean;
    merged: boolean;
    reviewDecision: PullRequestReviewDecision | null;
    mergeable: MergeableState;
    mergeStateStatus: MergeStateStatus;
    baseRefOid: string;
    stack: { id: string; number: number; size: number } | null;
    stackEntry: { position: number } | null;
    baseRef: { target: { oid: string } | { oid: string } | { oid: string } | { oid: string } | null } | null;
    statusCheckRollup: {
        state: StatusState;
        contexts: {
            checkRunCountsByState: Array<{ state: CheckRunState; count: number }> | null;
            statusContextCountsByState: Array<{ state: StatusState; count: number }> | null;
        };
    } | null;
    reviewRequests: {
        nodes: Array<{
            requestedReviewer: { slug: string; name: string } | { login: string } | Record<PropertyKey, never> | null;
        } | null> | null;
    } | null;
    latestOpinionatedReviews: {
        nodes: Array<{
            state: PullRequestReviewState;
            author:
                | { login: string }
                | { login: string }
                | { login: string }
                | { login: string }
                | { login: string }
                | null;
        } | null> | null;
    } | null;
};

export type ReactionGroupFieldsFragment = {
    content: ReactionContent;
    viewerHasReacted: boolean;
    reactors: { totalCount: number };
};

export type RepositoryLabelFieldsFragment = { id: string; name: string; color: string; description: string | null };

export type RepositoryUserFieldsFragment = { id: string; login: string; name: string | null; avatarUrl: string };

export type TrackingProjectFieldsFragment = {
    id: string;
    title: string;
    number: number;
    url: string;
    closed: boolean;
    updatedAt: string;
    items: { totalCount: number };
    owner:
        | { __typename: 'Issue' }
        | { __typename: 'Organization'; login: string }
        | { __typename: 'PullRequest' }
        | { __typename: 'User'; login: string };
};

export type TrackingRepositoryFieldsFragment = {
    id: string;
    nameWithOwner: string;
    isPrivate: boolean;
    isArchived: boolean;
    pushedAt: string | null;
    viewerPermission: RepositoryPermission | null;
    owner: { login: string } | { login: string };
    issues: { totalCount: number };
    pullRequests: { totalCount: number };
};

export type TrackingRepositoryPageFieldsFragment = {
    totalCount: number;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: Array<{
        id: string;
        nameWithOwner: string;
        isPrivate: boolean;
        isArchived: boolean;
        pushedAt: string | null;
        viewerPermission: RepositoryPermission | null;
        owner: { login: string } | { login: string };
        issues: { totalCount: number };
        pullRequests: { totalCount: number };
    } | null> | null;
};

export type ViewerProjectFieldsFragment = { id: string; title: string; number: number; url: string; closed: boolean };

export type AddAssigneesMutationVariables = Exact<{
    assignableId: string;
    assigneeIds: Array<string> | string;
}>;

export type AddAssigneesMutation = {
    addAssigneesToAssignable: {
        assignable:
            | {
                  __typename: 'Issue';
                  id: string;
                  updatedAt: string;
                  assignees: { nodes: Array<{ id: string; login: string; avatarUrl: string } | null> | null };
              }
            | {
                  __typename: 'PullRequest';
                  id: string;
                  updatedAt: string;
                  assignees: { nodes: Array<{ id: string; login: string; avatarUrl: string } | null> | null };
              }
            | null;
    } | null;
};

export type AddCommentMutationVariables = Exact<{
    subjectId: string;
    body: string;
}>;

export type AddCommentMutation = {
    addComment: {
        commentEdge: {
            node: {
                id: string;
                url: string;
                createdAt: string;
                lastEditedAt: string | null;
                bodyHTML: string;
                author:
                    | { login: string; avatarUrl: string }
                    | { login: string; avatarUrl: string }
                    | { login: string; avatarUrl: string }
                    | { login: string; avatarUrl: string }
                    | { login: string; avatarUrl: string }
                    | null;
            } | null;
        } | null;
    } | null;
};

export type AddDraftIssueMutationVariables = Exact<{
    projectId: string;
    title: string;
    body?: string | null | undefined;
    assigneeIds?: Array<string> | string | null | undefined;
}>;

export type AddDraftIssueMutation = {
    addProjectV2DraftIssue: {
        projectItem: {
            isArchived: boolean;
            type: ProjectV2ItemType;
            id: string;
            updatedAt: string;
            content:
                | {
                      __typename: 'DraftIssue';
                      id: string;
                      title: string;
                      body: string;
                      createdAt: string;
                      updatedAt: string;
                      creator:
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | null;
                      assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
                  }
                | {
                      __typename: 'Issue';
                      id: string;
                      url: string;
                      number: number;
                      title: string;
                      stateReason: IssueStateReason | null;
                      createdAt: string;
                      updatedAt: string;
                      closedAt: string | null;
                      issueState: IssueState;
                      author:
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | null;
                      assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
                      labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
                      milestone: { title: string; dueOn: string | null } | null;
                      issueType: { name: string; color: IssueTypeColor } | null;
                      comments: { totalCount: number };
                      subIssuesSummary: { total: number; completed: number };
                      repository: {
                          nameWithOwner: string;
                          isPrivate: boolean;
                          viewerPermission: RepositoryPermission | null;
                          owner: { login: string } | { login: string };
                      };
                      projectItems: {
                          nodes: Array<{
                              id: string;
                              isArchived: boolean;
                              updatedAt: string;
                              project: { id: string; title: string; number: number; url: string };
                              fieldValueByName:
                                  | {
                                        name: string | null;
                                        color: ProjectV2SingleSelectFieldOptionColor;
                                        optionId: string | null;
                                    }
                                  | Record<PropertyKey, never>
                                  | null;
                          } | null> | null;
                      } | null;
                  }
                | {
                      __typename: 'PullRequest';
                      url: string;
                      number: number;
                      title: string;
                      createdAt: string;
                      closedAt: string | null;
                      additions: number;
                      deletions: number;
                      changedFiles: number;
                      headRefName: string;
                      baseRefName: string;
                      id: string;
                      updatedAt: string;
                      state: PullRequestState;
                      isDraft: boolean;
                      merged: boolean;
                      reviewDecision: PullRequestReviewDecision | null;
                      mergeable: MergeableState;
                      mergeStateStatus: MergeStateStatus;
                      baseRefOid: string;
                      author:
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | { login: string; avatarUrl: string }
                          | null;
                      assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
                      labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
                      milestone: { title: string; dueOn: string | null } | null;
                      comments: { totalCount: number };
                      closingIssuesReferences: { nodes: Array<{ id: string } | null> | null } | null;
                      repository: {
                          nameWithOwner: string;
                          isPrivate: boolean;
                          viewerPermission: RepositoryPermission | null;
                          owner: { login: string } | { login: string };
                      };
                      projectItems: {
                          nodes: Array<{
                              id: string;
                              isArchived: boolean;
                              updatedAt: string;
                              project: { id: string; title: string; number: number; url: string };
                              fieldValueByName:
                                  | {
                                        name: string | null;
                                        color: ProjectV2SingleSelectFieldOptionColor;
                                        optionId: string | null;
                                    }
                                  | Record<PropertyKey, never>
                                  | null;
                          } | null> | null;
                      } | null;
                      stack: { id: string; number: number; size: number } | null;
                      stackEntry: { position: number } | null;
                      baseRef: {
                          target: { oid: string } | { oid: string } | { oid: string } | { oid: string } | null;
                      } | null;
                      statusCheckRollup: {
                          state: StatusState;
                          contexts: {
                              checkRunCountsByState: Array<{ state: CheckRunState; count: number }> | null;
                              statusContextCountsByState: Array<{ state: StatusState; count: number }> | null;
                          };
                      } | null;
                      reviewRequests: {
                          nodes: Array<{
                              requestedReviewer:
                                  | { slug: string; name: string }
                                  | { login: string }
                                  | Record<PropertyKey, never>
                                  | null;
                          } | null> | null;
                      } | null;
                      latestOpinionatedReviews: {
                          nodes: Array<{
                              state: PullRequestReviewState;
                              author:
                                  | { login: string }
                                  | { login: string }
                                  | { login: string }
                                  | { login: string }
                                  | { login: string }
                                  | null;
                          } | null> | null;
                      } | null;
                  }
                | null;
            fieldValues: {
                nodes: Array<
                    | {
                          __typename: 'ProjectV2ItemFieldDateValue';
                          date: string | null;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | {
                          __typename: 'ProjectV2ItemFieldIterationValue';
                          iterationId: string;
                          title: string;
                          startDate: string;
                          duration: number;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | { __typename: 'ProjectV2ItemFieldLabelValue' }
                    | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
                    | {
                          __typename: 'ProjectV2ItemFieldMultiSelectValue';
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                          options: Array<{
                              id: string;
                              name: string;
                              color: ProjectV2SingleSelectFieldOptionColor;
                          }> | null;
                      }
                    | {
                          __typename: 'ProjectV2ItemFieldNumberValue';
                          number: number | null;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
                    | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
                    | { __typename: 'ProjectV2ItemFieldReviewerValue' }
                    | {
                          __typename: 'ProjectV2ItemFieldSingleSelectValue';
                          optionId: string | null;
                          name: string | null;
                          color: ProjectV2SingleSelectFieldOptionColor;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | {
                          __typename: 'ProjectV2ItemFieldTextValue';
                          text: string | null;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | { __typename: 'ProjectV2ItemFieldUserValue' }
                    | { __typename: 'ProjectV2ItemIssueFieldValue' }
                    | null
                > | null;
            };
        } | null;
    } | null;
};

export type AddLabelsMutationVariables = Exact<{
    labelableId: string;
    labelIds: Array<string> | string;
}>;

export type AddLabelsMutation = {
    addLabelsToLabelable: {
        labelable:
            | { labels: { nodes: Array<{ id: string; name: string; color: string } | null> | null } | null }
            | {
                  __typename: 'Issue';
                  id: string;
                  updatedAt: string;
                  labels: { nodes: Array<{ id: string; name: string; color: string } | null> | null } | null;
              }
            | {
                  __typename: 'PullRequest';
                  id: string;
                  updatedAt: string;
                  labels: { nodes: Array<{ id: string; name: string; color: string } | null> | null } | null;
              }
            | null;
    } | null;
};

export type AddToProjectMutationVariables = Exact<{
    projectId: string;
    contentId: string;
}>;

export type AddToProjectMutation = {
    addProjectV2ItemById: {
        item: {
            id: string;
            isArchived: boolean;
            updatedAt: string;
            project: {
                viewerCanUpdate: boolean;
                id: string;
                title: string;
                number: number;
                url: string;
                fields: {
                    nodes: Array<
                        | { id: string; name: string; dataType: ProjectV2FieldType }
                        | {
                              id: string;
                              name: string;
                              dataType: ProjectV2FieldType;
                              configuration: {
                                  iterations: Array<{ id: string; title: string; startDate: string; duration: number }>;
                                  completedIterations: Array<{
                                      id: string;
                                      title: string;
                                      startDate: string;
                                      duration: number;
                                  }>;
                              };
                          }
                        | {
                              id: string;
                              name: string;
                              dataType: ProjectV2FieldType;
                              multiSelectOptions: Array<{
                                  id: string;
                                  name: string;
                                  color: ProjectV2SingleSelectFieldOptionColor;
                              }>;
                          }
                        | {
                              id: string;
                              name: string;
                              dataType: ProjectV2FieldType;
                              options: Array<{
                                  id: string;
                                  name: string;
                                  color: ProjectV2SingleSelectFieldOptionColor;
                              }>;
                          }
                        | null
                    > | null;
                };
            };
            fieldValueByName:
                | { name: string | null; color: ProjectV2SingleSelectFieldOptionColor; optionId: string | null }
                | Record<PropertyKey, never>
                | null;
            fieldValues: {
                nodes: Array<
                    | {
                          __typename: 'ProjectV2ItemFieldDateValue';
                          date: string | null;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | {
                          __typename: 'ProjectV2ItemFieldIterationValue';
                          iterationId: string;
                          title: string;
                          startDate: string;
                          duration: number;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | { __typename: 'ProjectV2ItemFieldLabelValue' }
                    | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
                    | {
                          __typename: 'ProjectV2ItemFieldMultiSelectValue';
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                          options: Array<{
                              id: string;
                              name: string;
                              color: ProjectV2SingleSelectFieldOptionColor;
                          }> | null;
                      }
                    | {
                          __typename: 'ProjectV2ItemFieldNumberValue';
                          number: number | null;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
                    | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
                    | { __typename: 'ProjectV2ItemFieldReviewerValue' }
                    | {
                          __typename: 'ProjectV2ItemFieldSingleSelectValue';
                          optionId: string | null;
                          name: string | null;
                          color: ProjectV2SingleSelectFieldOptionColor;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | {
                          __typename: 'ProjectV2ItemFieldTextValue';
                          text: string | null;
                          field: { id: string } | { id: string } | { id: string } | { id: string };
                      }
                    | { __typename: 'ProjectV2ItemFieldUserValue' }
                    | { __typename: 'ProjectV2ItemIssueFieldValue' }
                    | null
                > | null;
            };
        } | null;
    } | null;
};

export type ClearProjectFieldValueMutationVariables = Exact<{
    projectId: string;
    itemId: string;
    fieldId: string;
    fieldName: string;
}>;

export type ClearProjectFieldValueMutation = {
    clearProjectV2ItemFieldValue: {
        projectV2Item: {
            id: string;
            updatedAt: string;
            fieldValueByName:
                | {
                      __typename: 'ProjectV2ItemFieldDateValue';
                      date: string | null;
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                  }
                | {
                      __typename: 'ProjectV2ItemFieldIterationValue';
                      iterationId: string;
                      title: string;
                      startDate: string;
                      duration: number;
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                  }
                | { __typename: 'ProjectV2ItemFieldLabelValue' }
                | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
                | {
                      __typename: 'ProjectV2ItemFieldMultiSelectValue';
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                      options: Array<{ id: string; name: string; color: ProjectV2SingleSelectFieldOptionColor }> | null;
                  }
                | {
                      __typename: 'ProjectV2ItemFieldNumberValue';
                      number: number | null;
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                  }
                | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
                | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
                | { __typename: 'ProjectV2ItemFieldReviewerValue' }
                | {
                      __typename: 'ProjectV2ItemFieldSingleSelectValue';
                      optionId: string | null;
                      name: string | null;
                      color: ProjectV2SingleSelectFieldOptionColor;
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                  }
                | {
                      __typename: 'ProjectV2ItemFieldTextValue';
                      text: string | null;
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                  }
                | { __typename: 'ProjectV2ItemFieldUserValue' }
                | { __typename: 'ProjectV2ItemIssueFieldValue' }
                | null;
        } | null;
    } | null;
};

export type CloseIssueMutationVariables = Exact<{
    issueId: string;
    stateReason?: IssueClosedStateReason | null | undefined;
}>;

export type CloseIssueMutation = {
    closeIssue: {
        issue: {
            id: string;
            updatedAt: string;
            state: IssueState;
            stateReason: IssueStateReason | null;
            closedAt: string | null;
        } | null;
    } | null;
};

export type ClosePullRequestMutationVariables = Exact<{
    pullRequestId: string;
}>;

export type ClosePullRequestMutation = {
    closePullRequest: {
        pullRequest: {
            id: string;
            updatedAt: string;
            state: PullRequestState;
            isDraft: boolean;
            closedAt: string | null;
        } | null;
    } | null;
};

export type ConvertToDraftMutationVariables = Exact<{
    pullRequestId: string;
}>;

export type ConvertToDraftMutation = {
    convertPullRequestToDraft: {
        pullRequest: {
            id: string;
            updatedAt: string;
            state: PullRequestState;
            isDraft: boolean;
            closedAt: string | null;
        } | null;
    } | null;
};

export type CreateIssueMutationVariables = Exact<{
    repositoryId: string;
    title: string;
    body?: string | null | undefined;
    assigneeIds?: Array<string> | string | null | undefined;
    labelIds?: Array<string> | string | null | undefined;
    milestoneId?: string | null | undefined;
    issueTypeId?: string | null | undefined;
    parentIssueId?: string | null | undefined;
    projectV2Ids?: Array<string> | string | null | undefined;
}>;

export type CreateIssueMutation = {
    createIssue: {
        issue: {
            __typename: 'Issue';
            id: string;
            url: string;
            number: number;
            title: string;
            stateReason: IssueStateReason | null;
            createdAt: string;
            updatedAt: string;
            closedAt: string | null;
            issueState: IssueState;
            parent: { id: string } | null;
            author:
                | { login: string; avatarUrl: string }
                | { login: string; avatarUrl: string }
                | { login: string; avatarUrl: string }
                | { login: string; avatarUrl: string }
                | { login: string; avatarUrl: string }
                | null;
            assignees: { nodes: Array<{ login: string; avatarUrl: string } | null> | null };
            labels: { nodes: Array<{ name: string; color: string } | null> | null } | null;
            milestone: { title: string; dueOn: string | null } | null;
            issueType: { name: string; color: IssueTypeColor } | null;
            comments: { totalCount: number };
            subIssuesSummary: { total: number; completed: number };
            repository: {
                nameWithOwner: string;
                isPrivate: boolean;
                viewerPermission: RepositoryPermission | null;
                owner: { login: string } | { login: string };
            };
            projectItems: {
                nodes: Array<{
                    id: string;
                    isArchived: boolean;
                    updatedAt: string;
                    project: { id: string; title: string; number: number; url: string };
                    fieldValueByName:
                        | { name: string | null; color: ProjectV2SingleSelectFieldOptionColor; optionId: string | null }
                        | Record<PropertyKey, never>
                        | null;
                } | null> | null;
            } | null;
        } | null;
    } | null;
};

export type MarkReadyForReviewMutationVariables = Exact<{
    pullRequestId: string;
}>;

export type MarkReadyForReviewMutation = {
    markPullRequestReadyForReview: {
        pullRequest: {
            id: string;
            updatedAt: string;
            state: PullRequestState;
            isDraft: boolean;
            closedAt: string | null;
        } | null;
    } | null;
};

export type RemoveAssigneesMutationVariables = Exact<{
    assignableId: string;
    assigneeIds: Array<string> | string;
}>;

export type RemoveAssigneesMutation = {
    removeAssigneesFromAssignable: {
        assignable:
            | {
                  __typename: 'Issue';
                  id: string;
                  updatedAt: string;
                  assignees: { nodes: Array<{ id: string; login: string; avatarUrl: string } | null> | null };
              }
            | {
                  __typename: 'PullRequest';
                  id: string;
                  updatedAt: string;
                  assignees: { nodes: Array<{ id: string; login: string; avatarUrl: string } | null> | null };
              }
            | null;
    } | null;
};

export type RemoveLabelsMutationVariables = Exact<{
    labelableId: string;
    labelIds: Array<string> | string;
}>;

export type RemoveLabelsMutation = {
    removeLabelsFromLabelable: {
        labelable:
            | { labels: { nodes: Array<{ id: string; name: string; color: string } | null> | null } | null }
            | {
                  __typename: 'Issue';
                  id: string;
                  updatedAt: string;
                  labels: { nodes: Array<{ id: string; name: string; color: string } | null> | null } | null;
              }
            | {
                  __typename: 'PullRequest';
                  id: string;
                  updatedAt: string;
                  labels: { nodes: Array<{ id: string; name: string; color: string } | null> | null } | null;
              }
            | null;
    } | null;
};

export type ReopenIssueMutationVariables = Exact<{
    issueId: string;
}>;

export type ReopenIssueMutation = {
    reopenIssue: {
        issue: {
            id: string;
            updatedAt: string;
            state: IssueState;
            stateReason: IssueStateReason | null;
            closedAt: string | null;
        } | null;
    } | null;
};

export type ReopenPullRequestMutationVariables = Exact<{
    pullRequestId: string;
}>;

export type ReopenPullRequestMutation = {
    reopenPullRequest: {
        pullRequest: {
            id: string;
            updatedAt: string;
            state: PullRequestState;
            isDraft: boolean;
            closedAt: string | null;
        } | null;
    } | null;
};

export type RequestReviewsMutationVariables = Exact<{
    pullRequestId: string;
    userIds?: Array<string> | string | null | undefined;
    teamIds?: Array<string> | string | null | undefined;
}>;

export type RequestReviewsMutation = {
    requestReviews: {
        pullRequest: {
            id: string;
            updatedAt: string;
            reviewRequests: {
                nodes: Array<{
                    requestedReviewer:
                        | { __typename: 'Team'; id: string; slug: string; name: string }
                        | { __typename: 'User'; id: string; login: string; avatarUrl: string }
                        | Record<PropertyKey, never>
                        | null;
                } | null> | null;
            } | null;
        } | null;
    } | null;
};

export type SetProjectFieldValueMutationVariables = Exact<{
    projectId: string;
    itemId: string;
    fieldId: string;
    fieldName: string;
    value: ProjectV2FieldValue;
}>;

export type SetProjectFieldValueMutation = {
    updateProjectV2ItemFieldValue: {
        projectV2Item: {
            id: string;
            updatedAt: string;
            fieldValueByName:
                | {
                      __typename: 'ProjectV2ItemFieldDateValue';
                      date: string | null;
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                  }
                | {
                      __typename: 'ProjectV2ItemFieldIterationValue';
                      iterationId: string;
                      title: string;
                      startDate: string;
                      duration: number;
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                  }
                | { __typename: 'ProjectV2ItemFieldLabelValue' }
                | { __typename: 'ProjectV2ItemFieldMilestoneValue' }
                | {
                      __typename: 'ProjectV2ItemFieldMultiSelectValue';
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                      options: Array<{ id: string; name: string; color: ProjectV2SingleSelectFieldOptionColor }> | null;
                  }
                | {
                      __typename: 'ProjectV2ItemFieldNumberValue';
                      number: number | null;
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                  }
                | { __typename: 'ProjectV2ItemFieldPullRequestValue' }
                | { __typename: 'ProjectV2ItemFieldRepositoryValue' }
                | { __typename: 'ProjectV2ItemFieldReviewerValue' }
                | {
                      __typename: 'ProjectV2ItemFieldSingleSelectValue';
                      optionId: string | null;
                      name: string | null;
                      color: ProjectV2SingleSelectFieldOptionColor;
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                  }
                | {
                      __typename: 'ProjectV2ItemFieldTextValue';
                      text: string | null;
                      field: { id: string } | { id: string } | { id: string } | { id: string };
                  }
                | { __typename: 'ProjectV2ItemFieldUserValue' }
                | { __typename: 'ProjectV2ItemIssueFieldValue' }
                | null;
        } | null;
    } | null;
};

export type UpdateIssueMilestoneMutationVariables = Exact<{
    id: string;
    milestoneId?: string | null | undefined;
}>;

export type UpdateIssueMilestoneMutation = {
    updateIssue: {
        issue: {
            id: string;
            updatedAt: string;
            milestone: { id: string; title: string; dueOn: string | null } | null;
        } | null;
    } | null;
};

export type UpdateIssueTypeMutationVariables = Exact<{
    issueId: string;
    issueTypeId?: string | null | undefined;
}>;

export type UpdateIssueTypeMutation = {
    updateIssueIssueType: {
        issue: {
            id: string;
            updatedAt: string;
            issueType: { id: string; name: string; color: IssueTypeColor } | null;
        } | null;
    } | null;
};

export type UpdatePullRequestMilestoneMutationVariables = Exact<{
    pullRequestId: string;
    milestoneId?: string | null | undefined;
}>;

export type UpdatePullRequestMilestoneMutation = {
    updatePullRequest: {
        pullRequest: {
            id: string;
            updatedAt: string;
            milestone: { id: string; title: string; dueOn: string | null } | null;
        } | null;
    } | null;
};

export const AssignableResultFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment AssignableResultFields on Assignable {
  ... on Issue {
    __typename
    id
    updatedAt
  }
  ... on PullRequest {
    __typename
    id
    updatedAt
  }
  assignees(first: 10) {
    nodes {
      id
      login
      avatarUrl
    }
  }
}
    `,
    { fragmentName: 'AssignableResultFields' },
);
export const ItemRepositoryFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment ItemRepositoryFields on Repository {
  nameWithOwner
  isPrivate
  viewerPermission
  owner {
    login
  }
}
    `,
    { fragmentName: 'ItemRepositoryFields' },
);
export const ItemProjectItemFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
    `,
    { fragmentName: 'ItemProjectItemFields' },
);
export const IssueFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment IssueFields on Issue {
  __typename
  id
  url
  number
  title
  issueState: state
  stateReason
  createdAt
  updatedAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  issueType {
    name
    color
  }
  comments {
    totalCount
  }
  subIssuesSummary {
    total
    completed
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
    fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ItemRepositoryFields on Repository {
  nameWithOwner
  isPrivate
  viewerPermission
  owner {
    login
  }
}`,
    { fragmentName: 'IssueFields' },
);
export const ReactionGroupFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment ReactionGroupFields on ReactionGroup {
  content
  viewerHasReacted
  reactors {
    totalCount
  }
}
    `,
    { fragmentName: 'ReactionGroupFields' },
);
export const IssueCommentFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment IssueCommentFields on IssueComment {
  id
  url
  createdAt
  lastEditedAt
  author {
    login
    avatarUrl
  }
  bodyHTML
}
    `,
    { fragmentName: 'IssueCommentFields' },
);
export const CommentPageFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment CommentPageFields on IssueCommentConnection {
  totalCount
  pageInfo {
    hasPreviousPage
    startCursor
  }
  nodes {
    ...IssueCommentFields
  }
}
    fragment IssueCommentFields on IssueComment {
  id
  url
  createdAt
  lastEditedAt
  author {
    login
    avatarUrl
  }
  bodyHTML
}`,
    { fragmentName: 'CommentPageFields' },
);
export const LinkedIssueFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment LinkedIssueFields on Issue {
  id
  url
  number
  title
  state
  stateReason
  repository {
    nameWithOwner
  }
}
    `,
    { fragmentName: 'LinkedIssueFields' },
);
export const ProjectFieldIdFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment ProjectFieldIdFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
  }
}
    `,
    { fragmentName: 'ProjectFieldIdFields' },
);
export const ProjectItemFieldValueFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment ProjectItemFieldValueFields on ProjectV2ItemFieldValue {
  __typename
  ... on ProjectV2ItemFieldSingleSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    optionId
    name
    color
  }
  ... on ProjectV2ItemFieldMultiSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2ItemFieldTextValue {
    field {
      ...ProjectFieldIdFields
    }
    text
  }
  ... on ProjectV2ItemFieldNumberValue {
    field {
      ...ProjectFieldIdFields
    }
    number
  }
  ... on ProjectV2ItemFieldDateValue {
    field {
      ...ProjectFieldIdFields
    }
    date
  }
  ... on ProjectV2ItemFieldIterationValue {
    field {
      ...ProjectFieldIdFields
    }
    iterationId
    title
    startDate
    duration
  }
}
    fragment ProjectFieldIdFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
  }
}`,
    { fragmentName: 'ProjectItemFieldValueFields' },
);
export const ProjectItemValuesFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment ProjectItemValuesFields on ProjectV2Item {
  id
  updatedAt
  fieldValues(first: 50) {
    nodes {
      ...ProjectItemFieldValueFields
    }
  }
}
    fragment ProjectFieldIdFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
  }
}
fragment ProjectItemFieldValueFields on ProjectV2ItemFieldValue {
  __typename
  ... on ProjectV2ItemFieldSingleSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    optionId
    name
    color
  }
  ... on ProjectV2ItemFieldMultiSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2ItemFieldTextValue {
    field {
      ...ProjectFieldIdFields
    }
    text
  }
  ... on ProjectV2ItemFieldNumberValue {
    field {
      ...ProjectFieldIdFields
    }
    number
  }
  ... on ProjectV2ItemFieldDateValue {
    field {
      ...ProjectFieldIdFields
    }
    date
  }
  ... on ProjectV2ItemFieldIterationValue {
    field {
      ...ProjectFieldIdFields
    }
    iterationId
    title
    startDate
    duration
  }
}`,
    { fragmentName: 'ProjectItemValuesFields' },
);
export const ProjectIterationFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment ProjectIterationFields on ProjectV2IterationFieldIteration {
  id
  title
  startDate
  duration
}
    `,
    { fragmentName: 'ProjectIterationFields' },
);
export const ProjectFieldFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment ProjectFieldFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
    name
    dataType
  }
  ... on ProjectV2SingleSelectField {
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2MultiSelectField {
    multiSelectOptions {
      id
      name
      color
    }
  }
  ... on ProjectV2IterationField {
    configuration {
      iterations {
        ...ProjectIterationFields
      }
      completedIterations {
        ...ProjectIterationFields
      }
    }
  }
}
    fragment ProjectIterationFields on ProjectV2IterationFieldIteration {
  id
  title
  startDate
  duration
}`,
    { fragmentName: 'ProjectFieldFields' },
);
export const ProjectItemDetailFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment ProjectItemDetailFields on ProjectV2Item {
  ...ItemProjectItemFields
  ...ProjectItemValuesFields
  project {
    viewerCanUpdate
    fields(first: 50, orderBy: {field: POSITION, direction: ASC}) {
      nodes {
        ...ProjectFieldFields
      }
    }
  }
}
    fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ProjectFieldFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
    name
    dataType
  }
  ... on ProjectV2SingleSelectField {
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2MultiSelectField {
    multiSelectOptions {
      id
      name
      color
    }
  }
  ... on ProjectV2IterationField {
    configuration {
      iterations {
        ...ProjectIterationFields
      }
      completedIterations {
        ...ProjectIterationFields
      }
    }
  }
}
fragment ProjectFieldIdFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
  }
}
fragment ProjectItemFieldValueFields on ProjectV2ItemFieldValue {
  __typename
  ... on ProjectV2ItemFieldSingleSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    optionId
    name
    color
  }
  ... on ProjectV2ItemFieldMultiSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2ItemFieldTextValue {
    field {
      ...ProjectFieldIdFields
    }
    text
  }
  ... on ProjectV2ItemFieldNumberValue {
    field {
      ...ProjectFieldIdFields
    }
    number
  }
  ... on ProjectV2ItemFieldDateValue {
    field {
      ...ProjectFieldIdFields
    }
    date
  }
  ... on ProjectV2ItemFieldIterationValue {
    field {
      ...ProjectFieldIdFields
    }
    iterationId
    title
    startDate
    duration
  }
}
fragment ProjectItemValuesFields on ProjectV2Item {
  id
  updatedAt
  fieldValues(first: 50) {
    nodes {
      ...ProjectItemFieldValueFields
    }
  }
}
fragment ProjectIterationFields on ProjectV2IterationFieldIteration {
  id
  title
  startDate
  duration
}`,
    { fragmentName: 'ProjectItemDetailFields' },
);
export const IssueDetailFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment IssueDetailFields on Issue {
  ...IssueFields
  body
  bodyHTML
  reactionGroups {
    ...ReactionGroupFields
  }
  commentPage: comments(last: 50) {
    ...CommentPageFields
  }
  parent {
    ...LinkedIssueFields
  }
  subIssues(first: 50) {
    totalCount
    nodes {
      ...LinkedIssueFields
    }
  }
  blockedBy(first: 20) {
    totalCount
    nodes {
      ...LinkedIssueFields
    }
  }
  blocking(first: 20) {
    totalCount
    nodes {
      ...LinkedIssueFields
    }
  }
  projectItems(first: 10) {
    nodes {
      ...ProjectItemDetailFields
    }
  }
}
    fragment CommentPageFields on IssueCommentConnection {
  totalCount
  pageInfo {
    hasPreviousPage
    startCursor
  }
  nodes {
    ...IssueCommentFields
  }
}
fragment IssueCommentFields on IssueComment {
  id
  url
  createdAt
  lastEditedAt
  author {
    login
    avatarUrl
  }
  bodyHTML
}
fragment IssueFields on Issue {
  __typename
  id
  url
  number
  title
  issueState: state
  stateReason
  createdAt
  updatedAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  issueType {
    name
    color
  }
  comments {
    totalCount
  }
  subIssuesSummary {
    total
    completed
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ItemRepositoryFields on Repository {
  nameWithOwner
  isPrivate
  viewerPermission
  owner {
    login
  }
}
fragment LinkedIssueFields on Issue {
  id
  url
  number
  title
  state
  stateReason
  repository {
    nameWithOwner
  }
}
fragment ProjectFieldFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
    name
    dataType
  }
  ... on ProjectV2SingleSelectField {
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2MultiSelectField {
    multiSelectOptions {
      id
      name
      color
    }
  }
  ... on ProjectV2IterationField {
    configuration {
      iterations {
        ...ProjectIterationFields
      }
      completedIterations {
        ...ProjectIterationFields
      }
    }
  }
}
fragment ProjectFieldIdFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
  }
}
fragment ProjectItemDetailFields on ProjectV2Item {
  ...ItemProjectItemFields
  ...ProjectItemValuesFields
  project {
    viewerCanUpdate
    fields(first: 50, orderBy: {field: POSITION, direction: ASC}) {
      nodes {
        ...ProjectFieldFields
      }
    }
  }
}
fragment ProjectItemFieldValueFields on ProjectV2ItemFieldValue {
  __typename
  ... on ProjectV2ItemFieldSingleSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    optionId
    name
    color
  }
  ... on ProjectV2ItemFieldMultiSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2ItemFieldTextValue {
    field {
      ...ProjectFieldIdFields
    }
    text
  }
  ... on ProjectV2ItemFieldNumberValue {
    field {
      ...ProjectFieldIdFields
    }
    number
  }
  ... on ProjectV2ItemFieldDateValue {
    field {
      ...ProjectFieldIdFields
    }
    date
  }
  ... on ProjectV2ItemFieldIterationValue {
    field {
      ...ProjectFieldIdFields
    }
    iterationId
    title
    startDate
    duration
  }
}
fragment ProjectItemValuesFields on ProjectV2Item {
  id
  updatedAt
  fieldValues(first: 50) {
    nodes {
      ...ProjectItemFieldValueFields
    }
  }
}
fragment ProjectIterationFields on ProjectV2IterationFieldIteration {
  id
  title
  startDate
  duration
}
fragment ReactionGroupFields on ReactionGroup {
  content
  viewerHasReacted
  reactors {
    totalCount
  }
}`,
    { fragmentName: 'IssueDetailFields' },
);
export const IssueStateResultFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment IssueStateResultFields on Issue {
  id
  updatedAt
  state
  stateReason
  closedAt
}
    `,
    { fragmentName: 'IssueStateResultFields' },
);
export const LabelableResultFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment LabelableResultFields on Labelable {
  ... on Issue {
    __typename
    id
    updatedAt
  }
  ... on PullRequest {
    __typename
    id
    updatedAt
  }
  labels(first: 100) {
    nodes {
      id
      name
      color
    }
  }
}
    `,
    { fragmentName: 'LabelableResultFields' },
);
export const MilestoneResultFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment MilestoneResultFields on Milestone {
  id
  title
  dueOn
}
    `,
    { fragmentName: 'MilestoneResultFields' },
);
export const ProjectItemFieldResultFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment ProjectItemFieldResultFields on ProjectV2Item {
  id
  updatedAt
  fieldValueByName(name: $fieldName) {
    ...ProjectItemFieldValueFields
  }
}
    fragment ProjectFieldIdFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
  }
}
fragment ProjectItemFieldValueFields on ProjectV2ItemFieldValue {
  __typename
  ... on ProjectV2ItemFieldSingleSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    optionId
    name
    color
  }
  ... on ProjectV2ItemFieldMultiSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2ItemFieldTextValue {
    field {
      ...ProjectFieldIdFields
    }
    text
  }
  ... on ProjectV2ItemFieldNumberValue {
    field {
      ...ProjectFieldIdFields
    }
    number
  }
  ... on ProjectV2ItemFieldDateValue {
    field {
      ...ProjectFieldIdFields
    }
    date
  }
  ... on ProjectV2ItemFieldIterationValue {
    field {
      ...ProjectFieldIdFields
    }
    iterationId
    title
    startDate
    duration
  }
}`,
    { fragmentName: 'ProjectItemFieldResultFields' },
);
export const PullRequestStatusFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment PullRequestStatusFields on PullRequest {
  __typename
  id
  updatedAt
  state
  isDraft
  merged
  reviewDecision
  mergeable
  mergeStateStatus
  stack {
    id
    number
    size
  }
  stackEntry {
    position
  }
  baseRefOid
  baseRef {
    target {
      oid
    }
  }
  statusCheckRollup {
    state
    contexts {
      checkRunCountsByState {
        state
        count
      }
      statusContextCountsByState {
        state
        count
      }
    }
  }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User {
          login
        }
        ... on Team {
          slug
          name
        }
      }
    }
  }
  latestOpinionatedReviews(first: 10) {
    nodes {
      author {
        login
      }
      state
    }
  }
}
    `,
    { fragmentName: 'PullRequestStatusFields' },
);
export const PullRequestFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment PullRequestFields on PullRequest {
  ...PullRequestStatusFields
  url
  number
  title
  createdAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  comments {
    totalCount
  }
  additions
  deletions
  changedFiles
  headRefName
  baseRefName
  closingIssuesReferences(first: 10) {
    nodes {
      id
    }
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
    fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ItemRepositoryFields on Repository {
  nameWithOwner
  isPrivate
  viewerPermission
  owner {
    login
  }
}
fragment PullRequestStatusFields on PullRequest {
  __typename
  id
  updatedAt
  state
  isDraft
  merged
  reviewDecision
  mergeable
  mergeStateStatus
  stack {
    id
    number
    size
  }
  stackEntry {
    position
  }
  baseRefOid
  baseRef {
    target {
      oid
    }
  }
  statusCheckRollup {
    state
    contexts {
      checkRunCountsByState {
        state
        count
      }
      statusContextCountsByState {
        state
        count
      }
    }
  }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User {
          login
        }
        ... on Team {
          slug
          name
        }
      }
    }
  }
  latestOpinionatedReviews(first: 10) {
    nodes {
      author {
        login
      }
      state
    }
  }
}`,
    { fragmentName: 'PullRequestFields' },
);
export const DraftIssueFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment DraftIssueFields on DraftIssue {
  __typename
  id
  title
  body
  createdAt
  updatedAt
  creator {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
}
    `,
    { fragmentName: 'DraftIssueFields' },
);
export const ProjectItemRowFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment ProjectItemRowFields on ProjectV2Item {
  ...ProjectItemValuesFields
  isArchived
  type
  content {
    ... on Issue {
      ...IssueFields
    }
    ... on PullRequest {
      ...PullRequestFields
    }
    ... on DraftIssue {
      ...DraftIssueFields
    }
  }
}
    fragment DraftIssueFields on DraftIssue {
  __typename
  id
  title
  body
  createdAt
  updatedAt
  creator {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
}
fragment IssueFields on Issue {
  __typename
  id
  url
  number
  title
  issueState: state
  stateReason
  createdAt
  updatedAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  issueType {
    name
    color
  }
  comments {
    totalCount
  }
  subIssuesSummary {
    total
    completed
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ItemRepositoryFields on Repository {
  nameWithOwner
  isPrivate
  viewerPermission
  owner {
    login
  }
}
fragment ProjectFieldIdFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
  }
}
fragment ProjectItemFieldValueFields on ProjectV2ItemFieldValue {
  __typename
  ... on ProjectV2ItemFieldSingleSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    optionId
    name
    color
  }
  ... on ProjectV2ItemFieldMultiSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2ItemFieldTextValue {
    field {
      ...ProjectFieldIdFields
    }
    text
  }
  ... on ProjectV2ItemFieldNumberValue {
    field {
      ...ProjectFieldIdFields
    }
    number
  }
  ... on ProjectV2ItemFieldDateValue {
    field {
      ...ProjectFieldIdFields
    }
    date
  }
  ... on ProjectV2ItemFieldIterationValue {
    field {
      ...ProjectFieldIdFields
    }
    iterationId
    title
    startDate
    duration
  }
}
fragment ProjectItemValuesFields on ProjectV2Item {
  id
  updatedAt
  fieldValues(first: 50) {
    nodes {
      ...ProjectItemFieldValueFields
    }
  }
}
fragment PullRequestFields on PullRequest {
  ...PullRequestStatusFields
  url
  number
  title
  createdAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  comments {
    totalCount
  }
  additions
  deletions
  changedFiles
  headRefName
  baseRefName
  closingIssuesReferences(first: 10) {
    nodes {
      id
    }
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment PullRequestStatusFields on PullRequest {
  __typename
  id
  updatedAt
  state
  isDraft
  merged
  reviewDecision
  mergeable
  mergeStateStatus
  stack {
    id
    number
    size
  }
  stackEntry {
    position
  }
  baseRefOid
  baseRef {
    target {
      oid
    }
  }
  statusCheckRollup {
    state
    contexts {
      checkRunCountsByState {
        state
        count
      }
      statusContextCountsByState {
        state
        count
      }
    }
  }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User {
          login
        }
        ... on Team {
          slug
          name
        }
      }
    }
  }
  latestOpinionatedReviews(first: 10) {
    nodes {
      author {
        login
      }
      state
    }
  }
}`,
    { fragmentName: 'ProjectItemRowFields' },
);
export const ProjectItemPageFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment ProjectItemPageFields on ProjectV2ItemConnection {
  totalCount
  pageInfo {
    hasNextPage
    endCursor
  }
  nodes {
    ...ProjectItemRowFields
  }
}
    fragment DraftIssueFields on DraftIssue {
  __typename
  id
  title
  body
  createdAt
  updatedAt
  creator {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
}
fragment IssueFields on Issue {
  __typename
  id
  url
  number
  title
  issueState: state
  stateReason
  createdAt
  updatedAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  issueType {
    name
    color
  }
  comments {
    totalCount
  }
  subIssuesSummary {
    total
    completed
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ItemRepositoryFields on Repository {
  nameWithOwner
  isPrivate
  viewerPermission
  owner {
    login
  }
}
fragment ProjectFieldIdFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
  }
}
fragment ProjectItemFieldValueFields on ProjectV2ItemFieldValue {
  __typename
  ... on ProjectV2ItemFieldSingleSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    optionId
    name
    color
  }
  ... on ProjectV2ItemFieldMultiSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2ItemFieldTextValue {
    field {
      ...ProjectFieldIdFields
    }
    text
  }
  ... on ProjectV2ItemFieldNumberValue {
    field {
      ...ProjectFieldIdFields
    }
    number
  }
  ... on ProjectV2ItemFieldDateValue {
    field {
      ...ProjectFieldIdFields
    }
    date
  }
  ... on ProjectV2ItemFieldIterationValue {
    field {
      ...ProjectFieldIdFields
    }
    iterationId
    title
    startDate
    duration
  }
}
fragment ProjectItemRowFields on ProjectV2Item {
  ...ProjectItemValuesFields
  isArchived
  type
  content {
    ... on Issue {
      ...IssueFields
    }
    ... on PullRequest {
      ...PullRequestFields
    }
    ... on DraftIssue {
      ...DraftIssueFields
    }
  }
}
fragment ProjectItemValuesFields on ProjectV2Item {
  id
  updatedAt
  fieldValues(first: 50) {
    nodes {
      ...ProjectItemFieldValueFields
    }
  }
}
fragment PullRequestFields on PullRequest {
  ...PullRequestStatusFields
  url
  number
  title
  createdAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  comments {
    totalCount
  }
  additions
  deletions
  changedFiles
  headRefName
  baseRefName
  closingIssuesReferences(first: 10) {
    nodes {
      id
    }
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment PullRequestStatusFields on PullRequest {
  __typename
  id
  updatedAt
  state
  isDraft
  merged
  reviewDecision
  mergeable
  mergeStateStatus
  stack {
    id
    number
    size
  }
  stackEntry {
    position
  }
  baseRefOid
  baseRef {
    target {
      oid
    }
  }
  statusCheckRollup {
    state
    contexts {
      checkRunCountsByState {
        state
        count
      }
      statusContextCountsByState {
        state
        count
      }
    }
  }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User {
          login
        }
        ... on Team {
          slug
          name
        }
      }
    }
  }
  latestOpinionatedReviews(first: 10) {
    nodes {
      author {
        login
      }
      state
    }
  }
}`,
    { fragmentName: 'ProjectItemPageFields' },
);
export const ProjectFieldRefFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment ProjectFieldRefFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
    name
  }
}
    `,
    { fragmentName: 'ProjectFieldRefFields' },
);
export const ProjectViewFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment ProjectViewFields on ProjectV2View {
  id
  number
  name
  layout
  filter
  groupByFields(first: 5) {
    nodes {
      ...ProjectFieldRefFields
    }
  }
  verticalGroupByFields(first: 5) {
    nodes {
      ...ProjectFieldRefFields
    }
  }
  sortByFields(first: 5) {
    nodes {
      direction
      field {
        ...ProjectFieldRefFields
      }
    }
  }
  fields(first: 50) {
    nodes {
      ...ProjectFieldRefFields
    }
  }
}
    fragment ProjectFieldRefFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
    name
  }
}`,
    { fragmentName: 'ProjectViewFields' },
);
export const PullRequestDetailFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment PullRequestDetailFields on PullRequest {
  ...PullRequestFields
  body
  bodyHTML
  reactionGroups {
    ...ReactionGroupFields
  }
  commentPage: comments(last: 50) {
    ...CommentPageFields
  }
  commits {
    totalCount
  }
  headRepository {
    nameWithOwner
  }
  statusCheckRollup {
    contextPage: contexts(first: 100) {
      totalCount
      nodes {
        ... on CheckRun {
          __typename
          id
          name
          status
          conclusion
          detailsUrl
          startedAt
          completedAt
          checkSuite {
            workflowRun {
              workflow {
                name
              }
            }
          }
        }
        ... on StatusContext {
          __typename
          id
          context
          state
          targetUrl
          createdAt
        }
      }
    }
  }
  latestReviews(first: 20) {
    nodes {
      author {
        login
        avatarUrl
      }
      state
      submittedAt
    }
  }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User {
          avatarUrl
        }
      }
    }
  }
  projectItems(first: 10) {
    nodes {
      ...ProjectItemDetailFields
    }
  }
}
    fragment CommentPageFields on IssueCommentConnection {
  totalCount
  pageInfo {
    hasPreviousPage
    startCursor
  }
  nodes {
    ...IssueCommentFields
  }
}
fragment IssueCommentFields on IssueComment {
  id
  url
  createdAt
  lastEditedAt
  author {
    login
    avatarUrl
  }
  bodyHTML
}
fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ItemRepositoryFields on Repository {
  nameWithOwner
  isPrivate
  viewerPermission
  owner {
    login
  }
}
fragment ProjectFieldFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
    name
    dataType
  }
  ... on ProjectV2SingleSelectField {
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2MultiSelectField {
    multiSelectOptions {
      id
      name
      color
    }
  }
  ... on ProjectV2IterationField {
    configuration {
      iterations {
        ...ProjectIterationFields
      }
      completedIterations {
        ...ProjectIterationFields
      }
    }
  }
}
fragment ProjectFieldIdFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
  }
}
fragment ProjectItemDetailFields on ProjectV2Item {
  ...ItemProjectItemFields
  ...ProjectItemValuesFields
  project {
    viewerCanUpdate
    fields(first: 50, orderBy: {field: POSITION, direction: ASC}) {
      nodes {
        ...ProjectFieldFields
      }
    }
  }
}
fragment ProjectItemFieldValueFields on ProjectV2ItemFieldValue {
  __typename
  ... on ProjectV2ItemFieldSingleSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    optionId
    name
    color
  }
  ... on ProjectV2ItemFieldMultiSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2ItemFieldTextValue {
    field {
      ...ProjectFieldIdFields
    }
    text
  }
  ... on ProjectV2ItemFieldNumberValue {
    field {
      ...ProjectFieldIdFields
    }
    number
  }
  ... on ProjectV2ItemFieldDateValue {
    field {
      ...ProjectFieldIdFields
    }
    date
  }
  ... on ProjectV2ItemFieldIterationValue {
    field {
      ...ProjectFieldIdFields
    }
    iterationId
    title
    startDate
    duration
  }
}
fragment ProjectItemValuesFields on ProjectV2Item {
  id
  updatedAt
  fieldValues(first: 50) {
    nodes {
      ...ProjectItemFieldValueFields
    }
  }
}
fragment ProjectIterationFields on ProjectV2IterationFieldIteration {
  id
  title
  startDate
  duration
}
fragment PullRequestFields on PullRequest {
  ...PullRequestStatusFields
  url
  number
  title
  createdAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  comments {
    totalCount
  }
  additions
  deletions
  changedFiles
  headRefName
  baseRefName
  closingIssuesReferences(first: 10) {
    nodes {
      id
    }
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment PullRequestStatusFields on PullRequest {
  __typename
  id
  updatedAt
  state
  isDraft
  merged
  reviewDecision
  mergeable
  mergeStateStatus
  stack {
    id
    number
    size
  }
  stackEntry {
    position
  }
  baseRefOid
  baseRef {
    target {
      oid
    }
  }
  statusCheckRollup {
    state
    contexts {
      checkRunCountsByState {
        state
        count
      }
      statusContextCountsByState {
        state
        count
      }
    }
  }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User {
          login
        }
        ... on Team {
          slug
          name
        }
      }
    }
  }
  latestOpinionatedReviews(first: 10) {
    nodes {
      author {
        login
      }
      state
    }
  }
}
fragment ReactionGroupFields on ReactionGroup {
  content
  viewerHasReacted
  reactors {
    totalCount
  }
}`,
    { fragmentName: 'PullRequestDetailFields' },
);
export const PullRequestStateResultFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment PullRequestStateResultFields on PullRequest {
  id
  updatedAt
  state
  isDraft
  closedAt
}
    `,
    { fragmentName: 'PullRequestStateResultFields' },
);
export const RepositoryLabelFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment RepositoryLabelFields on Label {
  id
  name
  color
  description
}
    `,
    { fragmentName: 'RepositoryLabelFields' },
);
export const RepositoryUserFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment RepositoryUserFields on User {
  id
  login
  name
  avatarUrl
}
    `,
    { fragmentName: 'RepositoryUserFields' },
);
export const TrackingProjectFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment TrackingProjectFields on ProjectV2 {
  id
  title
  number
  url
  closed
  updatedAt
  items {
    totalCount
  }
  owner {
    __typename
    ... on Organization {
      login
    }
    ... on User {
      login
    }
  }
}
    `,
    { fragmentName: 'TrackingProjectFields' },
);
export const TrackingRepositoryFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment TrackingRepositoryFields on Repository {
  id
  nameWithOwner
  isPrivate
  isArchived
  pushedAt
  viewerPermission
  owner {
    login
  }
  issues(states: OPEN) {
    totalCount
  }
  pullRequests(states: OPEN) {
    totalCount
  }
}
    `,
    { fragmentName: 'TrackingRepositoryFields' },
);
export const TrackingRepositoryPageFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment TrackingRepositoryPageFields on RepositoryConnection {
  totalCount
  pageInfo {
    hasNextPage
    endCursor
  }
  nodes {
    ...TrackingRepositoryFields
  }
}
    fragment TrackingRepositoryFields on Repository {
  id
  nameWithOwner
  isPrivate
  isArchived
  pushedAt
  viewerPermission
  owner {
    login
  }
  issues(states: OPEN) {
    totalCount
  }
  pullRequests(states: OPEN) {
    totalCount
  }
}`,
    { fragmentName: 'TrackingRepositoryPageFields' },
);
export const ViewerProjectFieldsFragmentDoc = new TypedDocumentString(
    `
    fragment ViewerProjectFields on ProjectV2 {
  id
  title
  number
  url
  closed
}
    `,
    { fragmentName: 'ViewerProjectFields' },
);
export const ItemByNumberDocument = new TypedDocumentString(`
    query ItemByNumber($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issueOrPullRequest(number: $number) {
      ... on Issue {
        id
      }
      ... on PullRequest {
        id
      }
    }
  }
}
    `);
export const ItemDetailDocument = new TypedDocumentString(`
    query ItemDetail($id: ID!) {
  node(id: $id) {
    ... on Issue {
      ...IssueDetailFields
    }
    ... on PullRequest {
      ...PullRequestDetailFields
    }
  }
}
    fragment CommentPageFields on IssueCommentConnection {
  totalCount
  pageInfo {
    hasPreviousPage
    startCursor
  }
  nodes {
    ...IssueCommentFields
  }
}
fragment IssueCommentFields on IssueComment {
  id
  url
  createdAt
  lastEditedAt
  author {
    login
    avatarUrl
  }
  bodyHTML
}
fragment IssueDetailFields on Issue {
  ...IssueFields
  body
  bodyHTML
  reactionGroups {
    ...ReactionGroupFields
  }
  commentPage: comments(last: 50) {
    ...CommentPageFields
  }
  parent {
    ...LinkedIssueFields
  }
  subIssues(first: 50) {
    totalCount
    nodes {
      ...LinkedIssueFields
    }
  }
  blockedBy(first: 20) {
    totalCount
    nodes {
      ...LinkedIssueFields
    }
  }
  blocking(first: 20) {
    totalCount
    nodes {
      ...LinkedIssueFields
    }
  }
  projectItems(first: 10) {
    nodes {
      ...ProjectItemDetailFields
    }
  }
}
fragment IssueFields on Issue {
  __typename
  id
  url
  number
  title
  issueState: state
  stateReason
  createdAt
  updatedAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  issueType {
    name
    color
  }
  comments {
    totalCount
  }
  subIssuesSummary {
    total
    completed
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ItemRepositoryFields on Repository {
  nameWithOwner
  isPrivate
  viewerPermission
  owner {
    login
  }
}
fragment LinkedIssueFields on Issue {
  id
  url
  number
  title
  state
  stateReason
  repository {
    nameWithOwner
  }
}
fragment ProjectFieldFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
    name
    dataType
  }
  ... on ProjectV2SingleSelectField {
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2MultiSelectField {
    multiSelectOptions {
      id
      name
      color
    }
  }
  ... on ProjectV2IterationField {
    configuration {
      iterations {
        ...ProjectIterationFields
      }
      completedIterations {
        ...ProjectIterationFields
      }
    }
  }
}
fragment ProjectFieldIdFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
  }
}
fragment ProjectItemDetailFields on ProjectV2Item {
  ...ItemProjectItemFields
  ...ProjectItemValuesFields
  project {
    viewerCanUpdate
    fields(first: 50, orderBy: {field: POSITION, direction: ASC}) {
      nodes {
        ...ProjectFieldFields
      }
    }
  }
}
fragment ProjectItemFieldValueFields on ProjectV2ItemFieldValue {
  __typename
  ... on ProjectV2ItemFieldSingleSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    optionId
    name
    color
  }
  ... on ProjectV2ItemFieldMultiSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2ItemFieldTextValue {
    field {
      ...ProjectFieldIdFields
    }
    text
  }
  ... on ProjectV2ItemFieldNumberValue {
    field {
      ...ProjectFieldIdFields
    }
    number
  }
  ... on ProjectV2ItemFieldDateValue {
    field {
      ...ProjectFieldIdFields
    }
    date
  }
  ... on ProjectV2ItemFieldIterationValue {
    field {
      ...ProjectFieldIdFields
    }
    iterationId
    title
    startDate
    duration
  }
}
fragment ProjectItemValuesFields on ProjectV2Item {
  id
  updatedAt
  fieldValues(first: 50) {
    nodes {
      ...ProjectItemFieldValueFields
    }
  }
}
fragment ProjectIterationFields on ProjectV2IterationFieldIteration {
  id
  title
  startDate
  duration
}
fragment PullRequestDetailFields on PullRequest {
  ...PullRequestFields
  body
  bodyHTML
  reactionGroups {
    ...ReactionGroupFields
  }
  commentPage: comments(last: 50) {
    ...CommentPageFields
  }
  commits {
    totalCount
  }
  headRepository {
    nameWithOwner
  }
  statusCheckRollup {
    contextPage: contexts(first: 100) {
      totalCount
      nodes {
        ... on CheckRun {
          __typename
          id
          name
          status
          conclusion
          detailsUrl
          startedAt
          completedAt
          checkSuite {
            workflowRun {
              workflow {
                name
              }
            }
          }
        }
        ... on StatusContext {
          __typename
          id
          context
          state
          targetUrl
          createdAt
        }
      }
    }
  }
  latestReviews(first: 20) {
    nodes {
      author {
        login
        avatarUrl
      }
      state
      submittedAt
    }
  }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User {
          avatarUrl
        }
      }
    }
  }
  projectItems(first: 10) {
    nodes {
      ...ProjectItemDetailFields
    }
  }
}
fragment PullRequestFields on PullRequest {
  ...PullRequestStatusFields
  url
  number
  title
  createdAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  comments {
    totalCount
  }
  additions
  deletions
  changedFiles
  headRefName
  baseRefName
  closingIssuesReferences(first: 10) {
    nodes {
      id
    }
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment PullRequestStatusFields on PullRequest {
  __typename
  id
  updatedAt
  state
  isDraft
  merged
  reviewDecision
  mergeable
  mergeStateStatus
  stack {
    id
    number
    size
  }
  stackEntry {
    position
  }
  baseRefOid
  baseRef {
    target {
      oid
    }
  }
  statusCheckRollup {
    state
    contexts {
      checkRunCountsByState {
        state
        count
      }
      statusContextCountsByState {
        state
        count
      }
    }
  }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User {
          login
        }
        ... on Team {
          slug
          name
        }
      }
    }
  }
  latestOpinionatedReviews(first: 10) {
    nodes {
      author {
        login
      }
      state
    }
  }
}
fragment ReactionGroupFields on ReactionGroup {
  content
  viewerHasReacted
  reactors {
    totalCount
  }
}`);
export const ItemDetailsDocument = new TypedDocumentString(`
    query ItemDetails($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Issue {
      ...IssueDetailFields
    }
    ... on PullRequest {
      ...PullRequestDetailFields
    }
  }
}
    fragment CommentPageFields on IssueCommentConnection {
  totalCount
  pageInfo {
    hasPreviousPage
    startCursor
  }
  nodes {
    ...IssueCommentFields
  }
}
fragment IssueCommentFields on IssueComment {
  id
  url
  createdAt
  lastEditedAt
  author {
    login
    avatarUrl
  }
  bodyHTML
}
fragment IssueDetailFields on Issue {
  ...IssueFields
  body
  bodyHTML
  reactionGroups {
    ...ReactionGroupFields
  }
  commentPage: comments(last: 50) {
    ...CommentPageFields
  }
  parent {
    ...LinkedIssueFields
  }
  subIssues(first: 50) {
    totalCount
    nodes {
      ...LinkedIssueFields
    }
  }
  blockedBy(first: 20) {
    totalCount
    nodes {
      ...LinkedIssueFields
    }
  }
  blocking(first: 20) {
    totalCount
    nodes {
      ...LinkedIssueFields
    }
  }
  projectItems(first: 10) {
    nodes {
      ...ProjectItemDetailFields
    }
  }
}
fragment IssueFields on Issue {
  __typename
  id
  url
  number
  title
  issueState: state
  stateReason
  createdAt
  updatedAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  issueType {
    name
    color
  }
  comments {
    totalCount
  }
  subIssuesSummary {
    total
    completed
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ItemRepositoryFields on Repository {
  nameWithOwner
  isPrivate
  viewerPermission
  owner {
    login
  }
}
fragment LinkedIssueFields on Issue {
  id
  url
  number
  title
  state
  stateReason
  repository {
    nameWithOwner
  }
}
fragment ProjectFieldFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
    name
    dataType
  }
  ... on ProjectV2SingleSelectField {
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2MultiSelectField {
    multiSelectOptions {
      id
      name
      color
    }
  }
  ... on ProjectV2IterationField {
    configuration {
      iterations {
        ...ProjectIterationFields
      }
      completedIterations {
        ...ProjectIterationFields
      }
    }
  }
}
fragment ProjectFieldIdFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
  }
}
fragment ProjectItemDetailFields on ProjectV2Item {
  ...ItemProjectItemFields
  ...ProjectItemValuesFields
  project {
    viewerCanUpdate
    fields(first: 50, orderBy: {field: POSITION, direction: ASC}) {
      nodes {
        ...ProjectFieldFields
      }
    }
  }
}
fragment ProjectItemFieldValueFields on ProjectV2ItemFieldValue {
  __typename
  ... on ProjectV2ItemFieldSingleSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    optionId
    name
    color
  }
  ... on ProjectV2ItemFieldMultiSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2ItemFieldTextValue {
    field {
      ...ProjectFieldIdFields
    }
    text
  }
  ... on ProjectV2ItemFieldNumberValue {
    field {
      ...ProjectFieldIdFields
    }
    number
  }
  ... on ProjectV2ItemFieldDateValue {
    field {
      ...ProjectFieldIdFields
    }
    date
  }
  ... on ProjectV2ItemFieldIterationValue {
    field {
      ...ProjectFieldIdFields
    }
    iterationId
    title
    startDate
    duration
  }
}
fragment ProjectItemValuesFields on ProjectV2Item {
  id
  updatedAt
  fieldValues(first: 50) {
    nodes {
      ...ProjectItemFieldValueFields
    }
  }
}
fragment ProjectIterationFields on ProjectV2IterationFieldIteration {
  id
  title
  startDate
  duration
}
fragment PullRequestDetailFields on PullRequest {
  ...PullRequestFields
  body
  bodyHTML
  reactionGroups {
    ...ReactionGroupFields
  }
  commentPage: comments(last: 50) {
    ...CommentPageFields
  }
  commits {
    totalCount
  }
  headRepository {
    nameWithOwner
  }
  statusCheckRollup {
    contextPage: contexts(first: 100) {
      totalCount
      nodes {
        ... on CheckRun {
          __typename
          id
          name
          status
          conclusion
          detailsUrl
          startedAt
          completedAt
          checkSuite {
            workflowRun {
              workflow {
                name
              }
            }
          }
        }
        ... on StatusContext {
          __typename
          id
          context
          state
          targetUrl
          createdAt
        }
      }
    }
  }
  latestReviews(first: 20) {
    nodes {
      author {
        login
        avatarUrl
      }
      state
      submittedAt
    }
  }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User {
          avatarUrl
        }
      }
    }
  }
  projectItems(first: 10) {
    nodes {
      ...ProjectItemDetailFields
    }
  }
}
fragment PullRequestFields on PullRequest {
  ...PullRequestStatusFields
  url
  number
  title
  createdAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  comments {
    totalCount
  }
  additions
  deletions
  changedFiles
  headRefName
  baseRefName
  closingIssuesReferences(first: 10) {
    nodes {
      id
    }
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment PullRequestStatusFields on PullRequest {
  __typename
  id
  updatedAt
  state
  isDraft
  merged
  reviewDecision
  mergeable
  mergeStateStatus
  stack {
    id
    number
    size
  }
  stackEntry {
    position
  }
  baseRefOid
  baseRef {
    target {
      oid
    }
  }
  statusCheckRollup {
    state
    contexts {
      checkRunCountsByState {
        state
        count
      }
      statusContextCountsByState {
        state
        count
      }
    }
  }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User {
          login
        }
        ... on Team {
          slug
          name
        }
      }
    }
  }
  latestOpinionatedReviews(first: 10) {
    nodes {
      author {
        login
      }
      state
    }
  }
}
fragment ReactionGroupFields on ReactionGroup {
  content
  viewerHasReacted
  reactors {
    totalCount
  }
}`);
export const ItemsByIdsDocument = new TypedDocumentString(`
    query ItemsByIds($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Issue {
      ...IssueFields
    }
    ... on PullRequest {
      ...PullRequestFields
    }
  }
}
    fragment IssueFields on Issue {
  __typename
  id
  url
  number
  title
  issueState: state
  stateReason
  createdAt
  updatedAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  issueType {
    name
    color
  }
  comments {
    totalCount
  }
  subIssuesSummary {
    total
    completed
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ItemRepositoryFields on Repository {
  nameWithOwner
  isPrivate
  viewerPermission
  owner {
    login
  }
}
fragment PullRequestFields on PullRequest {
  ...PullRequestStatusFields
  url
  number
  title
  createdAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  comments {
    totalCount
  }
  additions
  deletions
  changedFiles
  headRefName
  baseRefName
  closingIssuesReferences(first: 10) {
    nodes {
      id
    }
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment PullRequestStatusFields on PullRequest {
  __typename
  id
  updatedAt
  state
  isDraft
  merged
  reviewDecision
  mergeable
  mergeStateStatus
  stack {
    id
    number
    size
  }
  stackEntry {
    position
  }
  baseRefOid
  baseRef {
    target {
      oid
    }
  }
  statusCheckRollup {
    state
    contexts {
      checkRunCountsByState {
        state
        count
      }
      statusContextCountsByState {
        state
        count
      }
    }
  }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User {
          login
        }
        ... on Team {
          slug
          name
        }
      }
    }
  }
  latestOpinionatedReviews(first: 10) {
    nodes {
      author {
        login
      }
      state
    }
  }
}`);
export const MoreCommentsDocument = new TypedDocumentString(`
    query MoreComments($id: ID!, $before: String!) {
  node(id: $id) {
    ... on Issue {
      id
      commentPage: comments(last: 100, before: $before) {
        ...CommentPageFields
      }
    }
    ... on PullRequest {
      id
      commentPage: comments(last: 100, before: $before) {
        ...CommentPageFields
      }
    }
  }
}
    fragment CommentPageFields on IssueCommentConnection {
  totalCount
  pageInfo {
    hasPreviousPage
    startCursor
  }
  nodes {
    ...IssueCommentFields
  }
}
fragment IssueCommentFields on IssueComment {
  id
  url
  createdAt
  lastEditedAt
  author {
    login
    avatarUrl
  }
  bodyHTML
}`);
export const OrganizationRepositoriesDocument = new TypedDocumentString(`
    query OrganizationRepositories($login: String!, $after: String) {
  organization(login: $login) {
    repositories(
      first: 100
      after: $after
      orderBy: {field: PUSHED_AT, direction: DESC}
    ) {
      ...TrackingRepositoryPageFields
    }
  }
}
    fragment TrackingRepositoryFields on Repository {
  id
  nameWithOwner
  isPrivate
  isArchived
  pushedAt
  viewerPermission
  owner {
    login
  }
  issues(states: OPEN) {
    totalCount
  }
  pullRequests(states: OPEN) {
    totalCount
  }
}
fragment TrackingRepositoryPageFields on RepositoryConnection {
  totalCount
  pageInfo {
    hasNextPage
    endCursor
  }
  nodes {
    ...TrackingRepositoryFields
  }
}`);
export const ProjectForTrackingDocument = new TypedDocumentString(`
    query ProjectForTracking($login: String!, $number: Int!) {
  repositoryOwner(login: $login) {
    ... on ProjectV2Owner {
      projectV2(number: $number) {
        ...TrackingProjectFields
      }
    }
  }
}
    fragment TrackingProjectFields on ProjectV2 {
  id
  title
  number
  url
  closed
  updatedAt
  items {
    totalCount
  }
  owner {
    __typename
    ... on Organization {
      login
    }
    ... on User {
      login
    }
  }
}`);
export const ProjectFullDocument = new TypedDocumentString(`
    query ProjectFull($id: ID!) {
  node(id: $id) {
    ... on ProjectV2 {
      id
      title
      number
      url
      closed
      updatedAt
      viewerCanUpdate
      owner {
        __typename
        ... on Organization {
          login
        }
        ... on User {
          login
        }
      }
      fields(first: 50, orderBy: {field: POSITION, direction: ASC}) {
        nodes {
          ...ProjectFieldFields
        }
      }
      views(first: 20, orderBy: {field: POSITION, direction: ASC}) {
        nodes {
          ...ProjectViewFields
        }
      }
      items(first: 100) {
        ...ProjectItemPageFields
      }
    }
  }
}
    fragment DraftIssueFields on DraftIssue {
  __typename
  id
  title
  body
  createdAt
  updatedAt
  creator {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
}
fragment IssueFields on Issue {
  __typename
  id
  url
  number
  title
  issueState: state
  stateReason
  createdAt
  updatedAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  issueType {
    name
    color
  }
  comments {
    totalCount
  }
  subIssuesSummary {
    total
    completed
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ItemRepositoryFields on Repository {
  nameWithOwner
  isPrivate
  viewerPermission
  owner {
    login
  }
}
fragment ProjectFieldFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
    name
    dataType
  }
  ... on ProjectV2SingleSelectField {
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2MultiSelectField {
    multiSelectOptions {
      id
      name
      color
    }
  }
  ... on ProjectV2IterationField {
    configuration {
      iterations {
        ...ProjectIterationFields
      }
      completedIterations {
        ...ProjectIterationFields
      }
    }
  }
}
fragment ProjectFieldIdFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
  }
}
fragment ProjectFieldRefFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
    name
  }
}
fragment ProjectItemFieldValueFields on ProjectV2ItemFieldValue {
  __typename
  ... on ProjectV2ItemFieldSingleSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    optionId
    name
    color
  }
  ... on ProjectV2ItemFieldMultiSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2ItemFieldTextValue {
    field {
      ...ProjectFieldIdFields
    }
    text
  }
  ... on ProjectV2ItemFieldNumberValue {
    field {
      ...ProjectFieldIdFields
    }
    number
  }
  ... on ProjectV2ItemFieldDateValue {
    field {
      ...ProjectFieldIdFields
    }
    date
  }
  ... on ProjectV2ItemFieldIterationValue {
    field {
      ...ProjectFieldIdFields
    }
    iterationId
    title
    startDate
    duration
  }
}
fragment ProjectItemPageFields on ProjectV2ItemConnection {
  totalCount
  pageInfo {
    hasNextPage
    endCursor
  }
  nodes {
    ...ProjectItemRowFields
  }
}
fragment ProjectItemRowFields on ProjectV2Item {
  ...ProjectItemValuesFields
  isArchived
  type
  content {
    ... on Issue {
      ...IssueFields
    }
    ... on PullRequest {
      ...PullRequestFields
    }
    ... on DraftIssue {
      ...DraftIssueFields
    }
  }
}
fragment ProjectItemValuesFields on ProjectV2Item {
  id
  updatedAt
  fieldValues(first: 50) {
    nodes {
      ...ProjectItemFieldValueFields
    }
  }
}
fragment ProjectIterationFields on ProjectV2IterationFieldIteration {
  id
  title
  startDate
  duration
}
fragment ProjectViewFields on ProjectV2View {
  id
  number
  name
  layout
  filter
  groupByFields(first: 5) {
    nodes {
      ...ProjectFieldRefFields
    }
  }
  verticalGroupByFields(first: 5) {
    nodes {
      ...ProjectFieldRefFields
    }
  }
  sortByFields(first: 5) {
    nodes {
      direction
      field {
        ...ProjectFieldRefFields
      }
    }
  }
  fields(first: 50) {
    nodes {
      ...ProjectFieldRefFields
    }
  }
}
fragment PullRequestFields on PullRequest {
  ...PullRequestStatusFields
  url
  number
  title
  createdAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  comments {
    totalCount
  }
  additions
  deletions
  changedFiles
  headRefName
  baseRefName
  closingIssuesReferences(first: 10) {
    nodes {
      id
    }
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment PullRequestStatusFields on PullRequest {
  __typename
  id
  updatedAt
  state
  isDraft
  merged
  reviewDecision
  mergeable
  mergeStateStatus
  stack {
    id
    number
    size
  }
  stackEntry {
    position
  }
  baseRefOid
  baseRef {
    target {
      oid
    }
  }
  statusCheckRollup {
    state
    contexts {
      checkRunCountsByState {
        state
        count
      }
      statusContextCountsByState {
        state
        count
      }
    }
  }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User {
          login
        }
        ... on Team {
          slug
          name
        }
      }
    }
  }
  latestOpinionatedReviews(first: 10) {
    nodes {
      author {
        login
      }
      state
    }
  }
}`);
export const ProjectItemsDocument = new TypedDocumentString(`
    query ProjectItems($id: ID!, $query: String!, $first: Int!, $after: String) {
  node(id: $id) {
    ... on ProjectV2 {
      items(first: $first, after: $after, query: $query) {
        ...ProjectItemPageFields
      }
    }
  }
}
    fragment DraftIssueFields on DraftIssue {
  __typename
  id
  title
  body
  createdAt
  updatedAt
  creator {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
}
fragment IssueFields on Issue {
  __typename
  id
  url
  number
  title
  issueState: state
  stateReason
  createdAt
  updatedAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  issueType {
    name
    color
  }
  comments {
    totalCount
  }
  subIssuesSummary {
    total
    completed
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ItemRepositoryFields on Repository {
  nameWithOwner
  isPrivate
  viewerPermission
  owner {
    login
  }
}
fragment ProjectFieldIdFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
  }
}
fragment ProjectItemFieldValueFields on ProjectV2ItemFieldValue {
  __typename
  ... on ProjectV2ItemFieldSingleSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    optionId
    name
    color
  }
  ... on ProjectV2ItemFieldMultiSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2ItemFieldTextValue {
    field {
      ...ProjectFieldIdFields
    }
    text
  }
  ... on ProjectV2ItemFieldNumberValue {
    field {
      ...ProjectFieldIdFields
    }
    number
  }
  ... on ProjectV2ItemFieldDateValue {
    field {
      ...ProjectFieldIdFields
    }
    date
  }
  ... on ProjectV2ItemFieldIterationValue {
    field {
      ...ProjectFieldIdFields
    }
    iterationId
    title
    startDate
    duration
  }
}
fragment ProjectItemPageFields on ProjectV2ItemConnection {
  totalCount
  pageInfo {
    hasNextPage
    endCursor
  }
  nodes {
    ...ProjectItemRowFields
  }
}
fragment ProjectItemRowFields on ProjectV2Item {
  ...ProjectItemValuesFields
  isArchived
  type
  content {
    ... on Issue {
      ...IssueFields
    }
    ... on PullRequest {
      ...PullRequestFields
    }
    ... on DraftIssue {
      ...DraftIssueFields
    }
  }
}
fragment ProjectItemValuesFields on ProjectV2Item {
  id
  updatedAt
  fieldValues(first: 50) {
    nodes {
      ...ProjectItemFieldValueFields
    }
  }
}
fragment PullRequestFields on PullRequest {
  ...PullRequestStatusFields
  url
  number
  title
  createdAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  comments {
    totalCount
  }
  additions
  deletions
  changedFiles
  headRefName
  baseRefName
  closingIssuesReferences(first: 10) {
    nodes {
      id
    }
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment PullRequestStatusFields on PullRequest {
  __typename
  id
  updatedAt
  state
  isDraft
  merged
  reviewDecision
  mergeable
  mergeStateStatus
  stack {
    id
    number
    size
  }
  stackEntry {
    position
  }
  baseRefOid
  baseRef {
    target {
      oid
    }
  }
  statusCheckRollup {
    state
    contexts {
      checkRunCountsByState {
        state
        count
      }
      statusContextCountsByState {
        state
        count
      }
    }
  }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User {
          login
        }
        ... on Team {
          slug
          name
        }
      }
    }
  }
  latestOpinionatedReviews(first: 10) {
    nodes {
      author {
        login
      }
      state
    }
  }
}`);
export const ProjectSchemaDocument = new TypedDocumentString(`
    query ProjectSchema($id: ID!) {
  node(id: $id) {
    ... on ProjectV2 {
      title
      closed
      viewerCanUpdate
      fields(first: 50, orderBy: {field: POSITION, direction: ASC}) {
        nodes {
          ...ProjectFieldFields
        }
      }
      views(first: 20, orderBy: {field: POSITION, direction: ASC}) {
        nodes {
          ...ProjectViewFields
        }
      }
      items {
        totalCount
      }
    }
  }
}
    fragment ProjectFieldFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
    name
    dataType
  }
  ... on ProjectV2SingleSelectField {
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2MultiSelectField {
    multiSelectOptions {
      id
      name
      color
    }
  }
  ... on ProjectV2IterationField {
    configuration {
      iterations {
        ...ProjectIterationFields
      }
      completedIterations {
        ...ProjectIterationFields
      }
    }
  }
}
fragment ProjectFieldRefFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
    name
  }
}
fragment ProjectIterationFields on ProjectV2IterationFieldIteration {
  id
  title
  startDate
  duration
}
fragment ProjectViewFields on ProjectV2View {
  id
  number
  name
  layout
  filter
  groupByFields(first: 5) {
    nodes {
      ...ProjectFieldRefFields
    }
  }
  verticalGroupByFields(first: 5) {
    nodes {
      ...ProjectFieldRefFields
    }
  }
  sortByFields(first: 5) {
    nodes {
      direction
      field {
        ...ProjectFieldRefFields
      }
    }
  }
  fields(first: 50) {
    nodes {
      ...ProjectFieldRefFields
    }
  }
}`);
export const ProjectUpdatedAtDocument = new TypedDocumentString(`
    query ProjectUpdatedAt($id: ID!) {
  node(id: $id) {
    ... on ProjectV2 {
      updatedAt
    }
  }
}
    `);
export const PullRequestStacksDocument = new TypedDocumentString(`
    query PullRequestStacks($ids: [ID!]!, $first: Int!) {
  nodes(ids: $ids) {
    ... on PullRequestStack {
      id
      entries(first: $first) {
        totalCount
        nodes {
          pullRequest {
            ...PullRequestFields
          }
        }
      }
    }
  }
}
    fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ItemRepositoryFields on Repository {
  nameWithOwner
  isPrivate
  viewerPermission
  owner {
    login
  }
}
fragment PullRequestFields on PullRequest {
  ...PullRequestStatusFields
  url
  number
  title
  createdAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  comments {
    totalCount
  }
  additions
  deletions
  changedFiles
  headRefName
  baseRefName
  closingIssuesReferences(first: 10) {
    nodes {
      id
    }
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment PullRequestStatusFields on PullRequest {
  __typename
  id
  updatedAt
  state
  isDraft
  merged
  reviewDecision
  mergeable
  mergeStateStatus
  stack {
    id
    number
    size
  }
  stackEntry {
    position
  }
  baseRefOid
  baseRef {
    target {
      oid
    }
  }
  statusCheckRollup {
    state
    contexts {
      checkRunCountsByState {
        state
        count
      }
      statusContextCountsByState {
        state
        count
      }
    }
  }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User {
          login
        }
        ... on Team {
          slug
          name
        }
      }
    }
  }
  latestOpinionatedReviews(first: 10) {
    nodes {
      author {
        login
      }
      state
    }
  }
}`);
export const PullRequestStatusesDocument = new TypedDocumentString(`
    query PullRequestStatuses($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on PullRequest {
      ...PullRequestStatusFields
    }
  }
}
    fragment PullRequestStatusFields on PullRequest {
  __typename
  id
  updatedAt
  state
  isDraft
  merged
  reviewDecision
  mergeable
  mergeStateStatus
  stack {
    id
    number
    size
  }
  stackEntry {
    position
  }
  baseRefOid
  baseRef {
    target {
      oid
    }
  }
  statusCheckRollup {
    state
    contexts {
      checkRunCountsByState {
        state
        count
      }
      statusContextCountsByState {
        state
        count
      }
    }
  }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User {
          login
        }
        ... on Team {
          slug
          name
        }
      }
    }
  }
  latestOpinionatedReviews(first: 10) {
    nodes {
      author {
        login
      }
      state
    }
  }
}`);
export const RepositoryAssignableUsersDocument = new TypedDocumentString(`
    query RepositoryAssignableUsers($owner: String!, $name: String!, $after: String!) {
  repository(owner: $owner, name: $name) {
    assignableUsers(first: 100, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...RepositoryUserFields
      }
    }
  }
}
    fragment RepositoryUserFields on User {
  id
  login
  name
  avatarUrl
}`);
export const RepositoryForTrackingDocument = new TypedDocumentString(`
    query RepositoryForTracking($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    ...TrackingRepositoryFields
  }
}
    fragment TrackingRepositoryFields on Repository {
  id
  nameWithOwner
  isPrivate
  isArchived
  pushedAt
  viewerPermission
  owner {
    login
  }
  issues(states: OPEN) {
    totalCount
  }
  pullRequests(states: OPEN) {
    totalCount
  }
}`);
export const RepositoryIssueTemplatesDocument = new TypedDocumentString(`
    query RepositoryIssueTemplates($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    nameWithOwner
    isBlankIssuesEnabled
    issueTemplates {
      name
      filename
      about
      title
      body
      labels(first: 20) {
        nodes {
          name
        }
      }
      assignees(first: 10) {
        nodes {
          login
        }
      }
      type {
        name
      }
    }
    templateFiles: object(expression: "HEAD:.github/ISSUE_TEMPLATE") {
      ... on Tree {
        entries {
          name
          object {
            ... on Blob {
              text
              isTruncated
            }
          }
        }
      }
    }
  }
}
    `);
export const RepositoryIssuesDocument = new TypedDocumentString(`
    query RepositoryIssues($owner: String!, $name: String!, $states: [IssueState!]!, $after: String) {
  repository(owner: $owner, name: $name) {
    issues(
      first: 100
      after: $after
      states: $states
      orderBy: {field: UPDATED_AT, direction: DESC}
    ) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...IssueFields
      }
    }
  }
}
    fragment IssueFields on Issue {
  __typename
  id
  url
  number
  title
  issueState: state
  stateReason
  createdAt
  updatedAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  issueType {
    name
    color
  }
  comments {
    totalCount
  }
  subIssuesSummary {
    total
    completed
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ItemRepositoryFields on Repository {
  nameWithOwner
  isPrivate
  viewerPermission
  owner {
    login
  }
}`);
export const RepositoryLabelDocument = new TypedDocumentString(`
    query RepositoryLabel($owner: String!, $name: String!, $label: String!) {
  repository(owner: $owner, name: $name) {
    label(name: $label) {
      ...RepositoryLabelFields
    }
  }
}
    fragment RepositoryLabelFields on Label {
  id
  name
  color
  description
}`);
export const RepositoryLabelsDocument = new TypedDocumentString(`
    query RepositoryLabels($owner: String!, $name: String!, $after: String!) {
  repository(owner: $owner, name: $name) {
    labels(first: 100, after: $after, orderBy: {field: NAME, direction: ASC}) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...RepositoryLabelFields
      }
    }
  }
}
    fragment RepositoryLabelFields on Label {
  id
  name
  color
  description
}`);
export const RepositoryMetadataDocument = new TypedDocumentString(`
    query RepositoryMetadata($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    id
    nameWithOwner
    viewerPermission
    isArchived
    hasIssuesEnabled
    labels(first: 100, orderBy: {field: NAME, direction: ASC}) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...RepositoryLabelFields
      }
    }
    milestones(first: 50, states: OPEN, orderBy: {field: DUE_DATE, direction: ASC}) {
      totalCount
      nodes {
        id
        title
        dueOn
      }
    }
    assignableUsers(first: 100) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...RepositoryUserFields
      }
    }
    issueTypes(first: 20) {
      nodes {
        id
        name
        color
        description
        isEnabled
      }
    }
  }
}
    fragment RepositoryLabelFields on Label {
  id
  name
  color
  description
}
fragment RepositoryUserFields on User {
  id
  login
  name
  avatarUrl
}`);
export const RepositoryPullRequestsDocument = new TypedDocumentString(`
    query RepositoryPullRequests($owner: String!, $name: String!, $states: [PullRequestState!]!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(
      first: $first
      after: $after
      states: $states
      orderBy: {field: UPDATED_AT, direction: DESC}
    ) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...PullRequestFields
      }
    }
  }
}
    fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ItemRepositoryFields on Repository {
  nameWithOwner
  isPrivate
  viewerPermission
  owner {
    login
  }
}
fragment PullRequestFields on PullRequest {
  ...PullRequestStatusFields
  url
  number
  title
  createdAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  comments {
    totalCount
  }
  additions
  deletions
  changedFiles
  headRefName
  baseRefName
  closingIssuesReferences(first: 10) {
    nodes {
      id
    }
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment PullRequestStatusFields on PullRequest {
  __typename
  id
  updatedAt
  state
  isDraft
  merged
  reviewDecision
  mergeable
  mergeStateStatus
  stack {
    id
    number
    size
  }
  stackEntry {
    position
  }
  baseRefOid
  baseRef {
    target {
      oid
    }
  }
  statusCheckRollup {
    state
    contexts {
      checkRunCountsByState {
        state
        count
      }
      statusContextCountsByState {
        state
        count
      }
    }
  }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User {
          login
        }
        ... on Team {
          slug
          name
        }
      }
    }
  }
  latestOpinionatedReviews(first: 10) {
    nodes {
      author {
        login
      }
      state
    }
  }
}`);
export const RepositorySearchDocument = new TypedDocumentString(`
    query RepositorySearch($query: String!) {
  search(query: $query, type: REPOSITORY, first: 10) {
    nodes {
      ... on Repository {
        nameWithOwner
        isPrivate
        isArchived
        hasIssuesEnabled
        viewerPermission
        pushedAt
      }
    }
  }
}
    `);
export const TrackingCandidatesDocument = new TypedDocumentString(`
    query TrackingCandidates {
  viewer {
    login
    repositories(
      first: 100
      ownerAffiliations: OWNER
      orderBy: {field: PUSHED_AT, direction: DESC}
    ) {
      ...TrackingRepositoryPageFields
    }
    organizations(first: 50) {
      nodes {
        login
        avatarUrl
        repositories(first: 20, orderBy: {field: PUSHED_AT, direction: DESC}) {
          ...TrackingRepositoryPageFields
        }
      }
    }
  }
}
    fragment TrackingRepositoryFields on Repository {
  id
  nameWithOwner
  isPrivate
  isArchived
  pushedAt
  viewerPermission
  owner {
    login
  }
  issues(states: OPEN) {
    totalCount
  }
  pullRequests(states: OPEN) {
    totalCount
  }
}
fragment TrackingRepositoryPageFields on RepositoryConnection {
  totalCount
  pageInfo {
    hasNextPage
    endCursor
  }
  nodes {
    ...TrackingRepositoryFields
  }
}`);
export const TrackingProjectsDocument = new TypedDocumentString(`
    query TrackingProjects {
  viewer {
    projectsV2(first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
      totalCount
      nodes {
        ...TrackingProjectFields
      }
    }
    organizations(first: 50) {
      nodes {
        login
        projectsV2(first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
          totalCount
          nodes {
            ...TrackingProjectFields
          }
        }
      }
    }
  }
}
    fragment TrackingProjectFields on ProjectV2 {
  id
  title
  number
  url
  closed
  updatedAt
  items {
    totalCount
  }
  owner {
    __typename
    ... on Organization {
      login
    }
    ... on User {
      login
    }
  }
}`);
export const UserByLoginDocument = new TypedDocumentString(`
    query UserByLogin($login: String!) {
  user(login: $login) {
    ...RepositoryUserFields
  }
}
    fragment RepositoryUserFields on User {
  id
  login
  name
  avatarUrl
}`);
export const ViewerDocument = new TypedDocumentString(`
    query Viewer {
  viewer {
    login
    name
    avatarUrl
  }
}
    `);
export const ViewerProjectsDocument = new TypedDocumentString(`
    query ViewerProjects {
  viewer {
    projectsV2(
      first: 50
      minPermissionLevel: WRITE
      orderBy: {field: UPDATED_AT, direction: DESC}
    ) {
      nodes {
        ...ViewerProjectFields
      }
    }
    organizations(first: 20) {
      nodes {
        login
        projectsV2(
          first: 50
          minPermissionLevel: WRITE
          orderBy: {field: UPDATED_AT, direction: DESC}
        ) {
          nodes {
            ...ViewerProjectFields
          }
        }
      }
    }
  }
}
    fragment ViewerProjectFields on ProjectV2 {
  id
  title
  number
  url
  closed
}`);
export const ViewerRepositoriesDocument = new TypedDocumentString(`
    query ViewerRepositories($after: String!) {
  viewer {
    repositories(
      first: 100
      after: $after
      ownerAffiliations: OWNER
      orderBy: {field: PUSHED_AT, direction: DESC}
    ) {
      ...TrackingRepositoryPageFields
    }
  }
}
    fragment TrackingRepositoryFields on Repository {
  id
  nameWithOwner
  isPrivate
  isArchived
  pushedAt
  viewerPermission
  owner {
    login
  }
  issues(states: OPEN) {
    totalCount
  }
  pullRequests(states: OPEN) {
    totalCount
  }
}
fragment TrackingRepositoryPageFields on RepositoryConnection {
  totalCount
  pageInfo {
    hasNextPage
    endCursor
  }
  nodes {
    ...TrackingRepositoryFields
  }
}`);
export const AddAssigneesDocument = new TypedDocumentString(`
    mutation AddAssignees($assignableId: ID!, $assigneeIds: [ID!]!) {
  addAssigneesToAssignable(
    input: {assignableId: $assignableId, assigneeIds: $assigneeIds}
  ) {
    assignable {
      ...AssignableResultFields
    }
  }
}
    fragment AssignableResultFields on Assignable {
  ... on Issue {
    __typename
    id
    updatedAt
  }
  ... on PullRequest {
    __typename
    id
    updatedAt
  }
  assignees(first: 10) {
    nodes {
      id
      login
      avatarUrl
    }
  }
}`);
export const AddCommentDocument = new TypedDocumentString(`
    mutation AddComment($subjectId: ID!, $body: String!) {
  addComment(input: {subjectId: $subjectId, body: $body}) {
    commentEdge {
      node {
        ...IssueCommentFields
      }
    }
  }
}
    fragment IssueCommentFields on IssueComment {
  id
  url
  createdAt
  lastEditedAt
  author {
    login
    avatarUrl
  }
  bodyHTML
}`);
export const AddDraftIssueDocument = new TypedDocumentString(`
    mutation AddDraftIssue($projectId: ID!, $title: String!, $body: String, $assigneeIds: [ID!]) {
  addProjectV2DraftIssue(
    input: {projectId: $projectId, title: $title, body: $body, assigneeIds: $assigneeIds}
  ) {
    projectItem {
      ...ProjectItemRowFields
    }
  }
}
    fragment DraftIssueFields on DraftIssue {
  __typename
  id
  title
  body
  createdAt
  updatedAt
  creator {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
}
fragment IssueFields on Issue {
  __typename
  id
  url
  number
  title
  issueState: state
  stateReason
  createdAt
  updatedAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  issueType {
    name
    color
  }
  comments {
    totalCount
  }
  subIssuesSummary {
    total
    completed
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ItemRepositoryFields on Repository {
  nameWithOwner
  isPrivate
  viewerPermission
  owner {
    login
  }
}
fragment ProjectFieldIdFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
  }
}
fragment ProjectItemFieldValueFields on ProjectV2ItemFieldValue {
  __typename
  ... on ProjectV2ItemFieldSingleSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    optionId
    name
    color
  }
  ... on ProjectV2ItemFieldMultiSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2ItemFieldTextValue {
    field {
      ...ProjectFieldIdFields
    }
    text
  }
  ... on ProjectV2ItemFieldNumberValue {
    field {
      ...ProjectFieldIdFields
    }
    number
  }
  ... on ProjectV2ItemFieldDateValue {
    field {
      ...ProjectFieldIdFields
    }
    date
  }
  ... on ProjectV2ItemFieldIterationValue {
    field {
      ...ProjectFieldIdFields
    }
    iterationId
    title
    startDate
    duration
  }
}
fragment ProjectItemRowFields on ProjectV2Item {
  ...ProjectItemValuesFields
  isArchived
  type
  content {
    ... on Issue {
      ...IssueFields
    }
    ... on PullRequest {
      ...PullRequestFields
    }
    ... on DraftIssue {
      ...DraftIssueFields
    }
  }
}
fragment ProjectItemValuesFields on ProjectV2Item {
  id
  updatedAt
  fieldValues(first: 50) {
    nodes {
      ...ProjectItemFieldValueFields
    }
  }
}
fragment PullRequestFields on PullRequest {
  ...PullRequestStatusFields
  url
  number
  title
  createdAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  comments {
    totalCount
  }
  additions
  deletions
  changedFiles
  headRefName
  baseRefName
  closingIssuesReferences(first: 10) {
    nodes {
      id
    }
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment PullRequestStatusFields on PullRequest {
  __typename
  id
  updatedAt
  state
  isDraft
  merged
  reviewDecision
  mergeable
  mergeStateStatus
  stack {
    id
    number
    size
  }
  stackEntry {
    position
  }
  baseRefOid
  baseRef {
    target {
      oid
    }
  }
  statusCheckRollup {
    state
    contexts {
      checkRunCountsByState {
        state
        count
      }
      statusContextCountsByState {
        state
        count
      }
    }
  }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User {
          login
        }
        ... on Team {
          slug
          name
        }
      }
    }
  }
  latestOpinionatedReviews(first: 10) {
    nodes {
      author {
        login
      }
      state
    }
  }
}`);
export const AddLabelsDocument = new TypedDocumentString(`
    mutation AddLabels($labelableId: ID!, $labelIds: [ID!]!) {
  addLabelsToLabelable(input: {labelableId: $labelableId, labelIds: $labelIds}) {
    labelable {
      ...LabelableResultFields
    }
  }
}
    fragment LabelableResultFields on Labelable {
  ... on Issue {
    __typename
    id
    updatedAt
  }
  ... on PullRequest {
    __typename
    id
    updatedAt
  }
  labels(first: 100) {
    nodes {
      id
      name
      color
    }
  }
}`);
export const AddToProjectDocument = new TypedDocumentString(`
    mutation AddToProject($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
    item {
      ...ProjectItemDetailFields
    }
  }
}
    fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ProjectFieldFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
    name
    dataType
  }
  ... on ProjectV2SingleSelectField {
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2MultiSelectField {
    multiSelectOptions {
      id
      name
      color
    }
  }
  ... on ProjectV2IterationField {
    configuration {
      iterations {
        ...ProjectIterationFields
      }
      completedIterations {
        ...ProjectIterationFields
      }
    }
  }
}
fragment ProjectFieldIdFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
  }
}
fragment ProjectItemDetailFields on ProjectV2Item {
  ...ItemProjectItemFields
  ...ProjectItemValuesFields
  project {
    viewerCanUpdate
    fields(first: 50, orderBy: {field: POSITION, direction: ASC}) {
      nodes {
        ...ProjectFieldFields
      }
    }
  }
}
fragment ProjectItemFieldValueFields on ProjectV2ItemFieldValue {
  __typename
  ... on ProjectV2ItemFieldSingleSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    optionId
    name
    color
  }
  ... on ProjectV2ItemFieldMultiSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2ItemFieldTextValue {
    field {
      ...ProjectFieldIdFields
    }
    text
  }
  ... on ProjectV2ItemFieldNumberValue {
    field {
      ...ProjectFieldIdFields
    }
    number
  }
  ... on ProjectV2ItemFieldDateValue {
    field {
      ...ProjectFieldIdFields
    }
    date
  }
  ... on ProjectV2ItemFieldIterationValue {
    field {
      ...ProjectFieldIdFields
    }
    iterationId
    title
    startDate
    duration
  }
}
fragment ProjectItemValuesFields on ProjectV2Item {
  id
  updatedAt
  fieldValues(first: 50) {
    nodes {
      ...ProjectItemFieldValueFields
    }
  }
}
fragment ProjectIterationFields on ProjectV2IterationFieldIteration {
  id
  title
  startDate
  duration
}`);
export const ClearProjectFieldValueDocument = new TypedDocumentString(`
    mutation ClearProjectFieldValue($projectId: ID!, $itemId: ID!, $fieldId: ID!, $fieldName: String!) {
  clearProjectV2ItemFieldValue(
    input: {projectId: $projectId, itemId: $itemId, fieldId: $fieldId}
  ) {
    projectV2Item {
      ...ProjectItemFieldResultFields
    }
  }
}
    fragment ProjectFieldIdFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
  }
}
fragment ProjectItemFieldResultFields on ProjectV2Item {
  id
  updatedAt
  fieldValueByName(name: $fieldName) {
    ...ProjectItemFieldValueFields
  }
}
fragment ProjectItemFieldValueFields on ProjectV2ItemFieldValue {
  __typename
  ... on ProjectV2ItemFieldSingleSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    optionId
    name
    color
  }
  ... on ProjectV2ItemFieldMultiSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2ItemFieldTextValue {
    field {
      ...ProjectFieldIdFields
    }
    text
  }
  ... on ProjectV2ItemFieldNumberValue {
    field {
      ...ProjectFieldIdFields
    }
    number
  }
  ... on ProjectV2ItemFieldDateValue {
    field {
      ...ProjectFieldIdFields
    }
    date
  }
  ... on ProjectV2ItemFieldIterationValue {
    field {
      ...ProjectFieldIdFields
    }
    iterationId
    title
    startDate
    duration
  }
}`);
export const CloseIssueDocument = new TypedDocumentString(`
    mutation CloseIssue($issueId: ID!, $stateReason: IssueClosedStateReason) {
  closeIssue(input: {issueId: $issueId, stateReason: $stateReason}) {
    issue {
      ...IssueStateResultFields
    }
  }
}
    fragment IssueStateResultFields on Issue {
  id
  updatedAt
  state
  stateReason
  closedAt
}`);
export const ClosePullRequestDocument = new TypedDocumentString(`
    mutation ClosePullRequest($pullRequestId: ID!) {
  closePullRequest(input: {pullRequestId: $pullRequestId}) {
    pullRequest {
      ...PullRequestStateResultFields
    }
  }
}
    fragment PullRequestStateResultFields on PullRequest {
  id
  updatedAt
  state
  isDraft
  closedAt
}`);
export const ConvertToDraftDocument = new TypedDocumentString(`
    mutation ConvertToDraft($pullRequestId: ID!) {
  convertPullRequestToDraft(input: {pullRequestId: $pullRequestId}) {
    pullRequest {
      ...PullRequestStateResultFields
    }
  }
}
    fragment PullRequestStateResultFields on PullRequest {
  id
  updatedAt
  state
  isDraft
  closedAt
}`);
export const CreateIssueDocument = new TypedDocumentString(`
    mutation CreateIssue($repositoryId: ID!, $title: String!, $body: String, $assigneeIds: [ID!], $labelIds: [ID!], $milestoneId: ID, $issueTypeId: ID, $parentIssueId: ID, $projectV2Ids: [ID!]) {
  createIssue(
    input: {repositoryId: $repositoryId, title: $title, body: $body, assigneeIds: $assigneeIds, labelIds: $labelIds, milestoneId: $milestoneId, issueTypeId: $issueTypeId, parentIssueId: $parentIssueId, projectV2Ids: $projectV2Ids}
  ) {
    issue {
      ...IssueFields
      parent {
        id
      }
    }
  }
}
    fragment IssueFields on Issue {
  __typename
  id
  url
  number
  title
  issueState: state
  stateReason
  createdAt
  updatedAt
  closedAt
  author {
    login
    avatarUrl
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  labels(first: 20) {
    nodes {
      name
      color
    }
  }
  milestone {
    title
    dueOn
  }
  issueType {
    name
    color
  }
  comments {
    totalCount
  }
  subIssuesSummary {
    total
    completed
  }
  repository {
    ...ItemRepositoryFields
  }
  projectItems(first: 10) {
    nodes {
      ...ItemProjectItemFields
    }
  }
}
fragment ItemProjectItemFields on ProjectV2Item {
  id
  isArchived
  updatedAt
  project {
    id
    title
    number
    url
  }
  fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue {
      name
      color
      optionId
    }
  }
}
fragment ItemRepositoryFields on Repository {
  nameWithOwner
  isPrivate
  viewerPermission
  owner {
    login
  }
}`);
export const MarkReadyForReviewDocument = new TypedDocumentString(`
    mutation MarkReadyForReview($pullRequestId: ID!) {
  markPullRequestReadyForReview(input: {pullRequestId: $pullRequestId}) {
    pullRequest {
      ...PullRequestStateResultFields
    }
  }
}
    fragment PullRequestStateResultFields on PullRequest {
  id
  updatedAt
  state
  isDraft
  closedAt
}`);
export const RemoveAssigneesDocument = new TypedDocumentString(`
    mutation RemoveAssignees($assignableId: ID!, $assigneeIds: [ID!]!) {
  removeAssigneesFromAssignable(
    input: {assignableId: $assignableId, assigneeIds: $assigneeIds}
  ) {
    assignable {
      ...AssignableResultFields
    }
  }
}
    fragment AssignableResultFields on Assignable {
  ... on Issue {
    __typename
    id
    updatedAt
  }
  ... on PullRequest {
    __typename
    id
    updatedAt
  }
  assignees(first: 10) {
    nodes {
      id
      login
      avatarUrl
    }
  }
}`);
export const RemoveLabelsDocument = new TypedDocumentString(`
    mutation RemoveLabels($labelableId: ID!, $labelIds: [ID!]!) {
  removeLabelsFromLabelable(
    input: {labelableId: $labelableId, labelIds: $labelIds}
  ) {
    labelable {
      ...LabelableResultFields
    }
  }
}
    fragment LabelableResultFields on Labelable {
  ... on Issue {
    __typename
    id
    updatedAt
  }
  ... on PullRequest {
    __typename
    id
    updatedAt
  }
  labels(first: 100) {
    nodes {
      id
      name
      color
    }
  }
}`);
export const ReopenIssueDocument = new TypedDocumentString(`
    mutation ReopenIssue($issueId: ID!) {
  reopenIssue(input: {issueId: $issueId}) {
    issue {
      ...IssueStateResultFields
    }
  }
}
    fragment IssueStateResultFields on Issue {
  id
  updatedAt
  state
  stateReason
  closedAt
}`);
export const ReopenPullRequestDocument = new TypedDocumentString(`
    mutation ReopenPullRequest($pullRequestId: ID!) {
  reopenPullRequest(input: {pullRequestId: $pullRequestId}) {
    pullRequest {
      ...PullRequestStateResultFields
    }
  }
}
    fragment PullRequestStateResultFields on PullRequest {
  id
  updatedAt
  state
  isDraft
  closedAt
}`);
export const RequestReviewsDocument = new TypedDocumentString(`
    mutation RequestReviews($pullRequestId: ID!, $userIds: [ID!], $teamIds: [ID!]) {
  requestReviews(
    input: {pullRequestId: $pullRequestId, userIds: $userIds, teamIds: $teamIds, union: true}
  ) {
    pullRequest {
      id
      updatedAt
      reviewRequests(first: 10) {
        nodes {
          requestedReviewer {
            ... on User {
              __typename
              id
              login
              avatarUrl
            }
            ... on Team {
              __typename
              id
              slug
              name
            }
          }
        }
      }
    }
  }
}
    `);
export const SetProjectFieldValueDocument = new TypedDocumentString(`
    mutation SetProjectFieldValue($projectId: ID!, $itemId: ID!, $fieldId: ID!, $fieldName: String!, $value: ProjectV2FieldValue!) {
  updateProjectV2ItemFieldValue(
    input: {projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value}
  ) {
    projectV2Item {
      ...ProjectItemFieldResultFields
    }
  }
}
    fragment ProjectFieldIdFields on ProjectV2FieldConfiguration {
  ... on ProjectV2FieldCommon {
    id
  }
}
fragment ProjectItemFieldResultFields on ProjectV2Item {
  id
  updatedAt
  fieldValueByName(name: $fieldName) {
    ...ProjectItemFieldValueFields
  }
}
fragment ProjectItemFieldValueFields on ProjectV2ItemFieldValue {
  __typename
  ... on ProjectV2ItemFieldSingleSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    optionId
    name
    color
  }
  ... on ProjectV2ItemFieldMultiSelectValue {
    field {
      ...ProjectFieldIdFields
    }
    options {
      id
      name
      color
    }
  }
  ... on ProjectV2ItemFieldTextValue {
    field {
      ...ProjectFieldIdFields
    }
    text
  }
  ... on ProjectV2ItemFieldNumberValue {
    field {
      ...ProjectFieldIdFields
    }
    number
  }
  ... on ProjectV2ItemFieldDateValue {
    field {
      ...ProjectFieldIdFields
    }
    date
  }
  ... on ProjectV2ItemFieldIterationValue {
    field {
      ...ProjectFieldIdFields
    }
    iterationId
    title
    startDate
    duration
  }
}`);
export const UpdateIssueMilestoneDocument = new TypedDocumentString(`
    mutation UpdateIssueMilestone($id: ID!, $milestoneId: ID) {
  updateIssue(input: {id: $id, milestoneId: $milestoneId}) {
    issue {
      id
      updatedAt
      milestone {
        ...MilestoneResultFields
      }
    }
  }
}
    fragment MilestoneResultFields on Milestone {
  id
  title
  dueOn
}`);
export const UpdateIssueTypeDocument = new TypedDocumentString(`
    mutation UpdateIssueType($issueId: ID!, $issueTypeId: ID) {
  updateIssueIssueType(input: {issueId: $issueId, issueTypeId: $issueTypeId}) {
    issue {
      id
      updatedAt
      issueType {
        id
        name
        color
      }
    }
  }
}
    `);
export const UpdatePullRequestMilestoneDocument = new TypedDocumentString(`
    mutation UpdatePullRequestMilestone($pullRequestId: ID!, $milestoneId: ID) {
  updatePullRequest(
    input: {pullRequestId: $pullRequestId, milestoneId: $milestoneId}
  ) {
    pullRequest {
      id
      updatedAt
      milestone {
        ...MilestoneResultFields
      }
    }
  }
}
    fragment MilestoneResultFields on Milestone {
  id
  title
  dueOn
}`);
export type Requester<C = {}> = <R, V>(doc: string, vars?: V, options?: C) => Promise<R> | AsyncIterable<R>;
export function getSdk<C>(requester: Requester<C>) {
    return {
        ItemByNumber(variables: ItemByNumberQueryVariables, options?: C): Promise<ItemByNumberQuery> {
            return requester<ItemByNumberQuery, ItemByNumberQueryVariables>(
                ItemByNumberDocument,
                variables,
                options,
            ) as Promise<ItemByNumberQuery>;
        },
        ItemDetail(variables: ItemDetailQueryVariables, options?: C): Promise<ItemDetailQuery> {
            return requester<ItemDetailQuery, ItemDetailQueryVariables>(
                ItemDetailDocument,
                variables,
                options,
            ) as Promise<ItemDetailQuery>;
        },
        ItemDetails(variables: ItemDetailsQueryVariables, options?: C): Promise<ItemDetailsQuery> {
            return requester<ItemDetailsQuery, ItemDetailsQueryVariables>(
                ItemDetailsDocument,
                variables,
                options,
            ) as Promise<ItemDetailsQuery>;
        },
        ItemsByIds(variables: ItemsByIdsQueryVariables, options?: C): Promise<ItemsByIdsQuery> {
            return requester<ItemsByIdsQuery, ItemsByIdsQueryVariables>(
                ItemsByIdsDocument,
                variables,
                options,
            ) as Promise<ItemsByIdsQuery>;
        },
        MoreComments(variables: MoreCommentsQueryVariables, options?: C): Promise<MoreCommentsQuery> {
            return requester<MoreCommentsQuery, MoreCommentsQueryVariables>(
                MoreCommentsDocument,
                variables,
                options,
            ) as Promise<MoreCommentsQuery>;
        },
        OrganizationRepositories(
            variables: OrganizationRepositoriesQueryVariables,
            options?: C,
        ): Promise<OrganizationRepositoriesQuery> {
            return requester<OrganizationRepositoriesQuery, OrganizationRepositoriesQueryVariables>(
                OrganizationRepositoriesDocument,
                variables,
                options,
            ) as Promise<OrganizationRepositoriesQuery>;
        },
        ProjectForTracking(variables: ProjectForTrackingQueryVariables, options?: C): Promise<ProjectForTrackingQuery> {
            return requester<ProjectForTrackingQuery, ProjectForTrackingQueryVariables>(
                ProjectForTrackingDocument,
                variables,
                options,
            ) as Promise<ProjectForTrackingQuery>;
        },
        ProjectFull(variables: ProjectFullQueryVariables, options?: C): Promise<ProjectFullQuery> {
            return requester<ProjectFullQuery, ProjectFullQueryVariables>(
                ProjectFullDocument,
                variables,
                options,
            ) as Promise<ProjectFullQuery>;
        },
        ProjectItems(variables: ProjectItemsQueryVariables, options?: C): Promise<ProjectItemsQuery> {
            return requester<ProjectItemsQuery, ProjectItemsQueryVariables>(
                ProjectItemsDocument,
                variables,
                options,
            ) as Promise<ProjectItemsQuery>;
        },
        ProjectSchema(variables: ProjectSchemaQueryVariables, options?: C): Promise<ProjectSchemaQuery> {
            return requester<ProjectSchemaQuery, ProjectSchemaQueryVariables>(
                ProjectSchemaDocument,
                variables,
                options,
            ) as Promise<ProjectSchemaQuery>;
        },
        ProjectUpdatedAt(variables: ProjectUpdatedAtQueryVariables, options?: C): Promise<ProjectUpdatedAtQuery> {
            return requester<ProjectUpdatedAtQuery, ProjectUpdatedAtQueryVariables>(
                ProjectUpdatedAtDocument,
                variables,
                options,
            ) as Promise<ProjectUpdatedAtQuery>;
        },
        PullRequestStacks(variables: PullRequestStacksQueryVariables, options?: C): Promise<PullRequestStacksQuery> {
            return requester<PullRequestStacksQuery, PullRequestStacksQueryVariables>(
                PullRequestStacksDocument,
                variables,
                options,
            ) as Promise<PullRequestStacksQuery>;
        },
        PullRequestStatuses(
            variables: PullRequestStatusesQueryVariables,
            options?: C,
        ): Promise<PullRequestStatusesQuery> {
            return requester<PullRequestStatusesQuery, PullRequestStatusesQueryVariables>(
                PullRequestStatusesDocument,
                variables,
                options,
            ) as Promise<PullRequestStatusesQuery>;
        },
        RepositoryAssignableUsers(
            variables: RepositoryAssignableUsersQueryVariables,
            options?: C,
        ): Promise<RepositoryAssignableUsersQuery> {
            return requester<RepositoryAssignableUsersQuery, RepositoryAssignableUsersQueryVariables>(
                RepositoryAssignableUsersDocument,
                variables,
                options,
            ) as Promise<RepositoryAssignableUsersQuery>;
        },
        RepositoryForTracking(
            variables: RepositoryForTrackingQueryVariables,
            options?: C,
        ): Promise<RepositoryForTrackingQuery> {
            return requester<RepositoryForTrackingQuery, RepositoryForTrackingQueryVariables>(
                RepositoryForTrackingDocument,
                variables,
                options,
            ) as Promise<RepositoryForTrackingQuery>;
        },
        RepositoryIssueTemplates(
            variables: RepositoryIssueTemplatesQueryVariables,
            options?: C,
        ): Promise<RepositoryIssueTemplatesQuery> {
            return requester<RepositoryIssueTemplatesQuery, RepositoryIssueTemplatesQueryVariables>(
                RepositoryIssueTemplatesDocument,
                variables,
                options,
            ) as Promise<RepositoryIssueTemplatesQuery>;
        },
        RepositoryIssues(variables: RepositoryIssuesQueryVariables, options?: C): Promise<RepositoryIssuesQuery> {
            return requester<RepositoryIssuesQuery, RepositoryIssuesQueryVariables>(
                RepositoryIssuesDocument,
                variables,
                options,
            ) as Promise<RepositoryIssuesQuery>;
        },
        RepositoryLabel(variables: RepositoryLabelQueryVariables, options?: C): Promise<RepositoryLabelQuery> {
            return requester<RepositoryLabelQuery, RepositoryLabelQueryVariables>(
                RepositoryLabelDocument,
                variables,
                options,
            ) as Promise<RepositoryLabelQuery>;
        },
        RepositoryLabels(variables: RepositoryLabelsQueryVariables, options?: C): Promise<RepositoryLabelsQuery> {
            return requester<RepositoryLabelsQuery, RepositoryLabelsQueryVariables>(
                RepositoryLabelsDocument,
                variables,
                options,
            ) as Promise<RepositoryLabelsQuery>;
        },
        RepositoryMetadata(variables: RepositoryMetadataQueryVariables, options?: C): Promise<RepositoryMetadataQuery> {
            return requester<RepositoryMetadataQuery, RepositoryMetadataQueryVariables>(
                RepositoryMetadataDocument,
                variables,
                options,
            ) as Promise<RepositoryMetadataQuery>;
        },
        RepositoryPullRequests(
            variables: RepositoryPullRequestsQueryVariables,
            options?: C,
        ): Promise<RepositoryPullRequestsQuery> {
            return requester<RepositoryPullRequestsQuery, RepositoryPullRequestsQueryVariables>(
                RepositoryPullRequestsDocument,
                variables,
                options,
            ) as Promise<RepositoryPullRequestsQuery>;
        },
        RepositorySearch(variables: RepositorySearchQueryVariables, options?: C): Promise<RepositorySearchQuery> {
            return requester<RepositorySearchQuery, RepositorySearchQueryVariables>(
                RepositorySearchDocument,
                variables,
                options,
            ) as Promise<RepositorySearchQuery>;
        },
        TrackingCandidates(
            variables?: TrackingCandidatesQueryVariables,
            options?: C,
        ): Promise<TrackingCandidatesQuery> {
            return requester<TrackingCandidatesQuery, TrackingCandidatesQueryVariables>(
                TrackingCandidatesDocument,
                variables,
                options,
            ) as Promise<TrackingCandidatesQuery>;
        },
        TrackingProjects(variables?: TrackingProjectsQueryVariables, options?: C): Promise<TrackingProjectsQuery> {
            return requester<TrackingProjectsQuery, TrackingProjectsQueryVariables>(
                TrackingProjectsDocument,
                variables,
                options,
            ) as Promise<TrackingProjectsQuery>;
        },
        UserByLogin(variables: UserByLoginQueryVariables, options?: C): Promise<UserByLoginQuery> {
            return requester<UserByLoginQuery, UserByLoginQueryVariables>(
                UserByLoginDocument,
                variables,
                options,
            ) as Promise<UserByLoginQuery>;
        },
        Viewer(variables?: ViewerQueryVariables, options?: C): Promise<ViewerQuery> {
            return requester<ViewerQuery, ViewerQueryVariables>(
                ViewerDocument,
                variables,
                options,
            ) as Promise<ViewerQuery>;
        },
        ViewerProjects(variables?: ViewerProjectsQueryVariables, options?: C): Promise<ViewerProjectsQuery> {
            return requester<ViewerProjectsQuery, ViewerProjectsQueryVariables>(
                ViewerProjectsDocument,
                variables,
                options,
            ) as Promise<ViewerProjectsQuery>;
        },
        ViewerRepositories(variables: ViewerRepositoriesQueryVariables, options?: C): Promise<ViewerRepositoriesQuery> {
            return requester<ViewerRepositoriesQuery, ViewerRepositoriesQueryVariables>(
                ViewerRepositoriesDocument,
                variables,
                options,
            ) as Promise<ViewerRepositoriesQuery>;
        },
        AddAssignees(variables: AddAssigneesMutationVariables, options?: C): Promise<AddAssigneesMutation> {
            return requester<AddAssigneesMutation, AddAssigneesMutationVariables>(
                AddAssigneesDocument,
                variables,
                options,
            ) as Promise<AddAssigneesMutation>;
        },
        AddComment(variables: AddCommentMutationVariables, options?: C): Promise<AddCommentMutation> {
            return requester<AddCommentMutation, AddCommentMutationVariables>(
                AddCommentDocument,
                variables,
                options,
            ) as Promise<AddCommentMutation>;
        },
        AddDraftIssue(variables: AddDraftIssueMutationVariables, options?: C): Promise<AddDraftIssueMutation> {
            return requester<AddDraftIssueMutation, AddDraftIssueMutationVariables>(
                AddDraftIssueDocument,
                variables,
                options,
            ) as Promise<AddDraftIssueMutation>;
        },
        AddLabels(variables: AddLabelsMutationVariables, options?: C): Promise<AddLabelsMutation> {
            return requester<AddLabelsMutation, AddLabelsMutationVariables>(
                AddLabelsDocument,
                variables,
                options,
            ) as Promise<AddLabelsMutation>;
        },
        AddToProject(variables: AddToProjectMutationVariables, options?: C): Promise<AddToProjectMutation> {
            return requester<AddToProjectMutation, AddToProjectMutationVariables>(
                AddToProjectDocument,
                variables,
                options,
            ) as Promise<AddToProjectMutation>;
        },
        ClearProjectFieldValue(
            variables: ClearProjectFieldValueMutationVariables,
            options?: C,
        ): Promise<ClearProjectFieldValueMutation> {
            return requester<ClearProjectFieldValueMutation, ClearProjectFieldValueMutationVariables>(
                ClearProjectFieldValueDocument,
                variables,
                options,
            ) as Promise<ClearProjectFieldValueMutation>;
        },
        CloseIssue(variables: CloseIssueMutationVariables, options?: C): Promise<CloseIssueMutation> {
            return requester<CloseIssueMutation, CloseIssueMutationVariables>(
                CloseIssueDocument,
                variables,
                options,
            ) as Promise<CloseIssueMutation>;
        },
        ClosePullRequest(variables: ClosePullRequestMutationVariables, options?: C): Promise<ClosePullRequestMutation> {
            return requester<ClosePullRequestMutation, ClosePullRequestMutationVariables>(
                ClosePullRequestDocument,
                variables,
                options,
            ) as Promise<ClosePullRequestMutation>;
        },
        ConvertToDraft(variables: ConvertToDraftMutationVariables, options?: C): Promise<ConvertToDraftMutation> {
            return requester<ConvertToDraftMutation, ConvertToDraftMutationVariables>(
                ConvertToDraftDocument,
                variables,
                options,
            ) as Promise<ConvertToDraftMutation>;
        },
        CreateIssue(variables: CreateIssueMutationVariables, options?: C): Promise<CreateIssueMutation> {
            return requester<CreateIssueMutation, CreateIssueMutationVariables>(
                CreateIssueDocument,
                variables,
                options,
            ) as Promise<CreateIssueMutation>;
        },
        MarkReadyForReview(
            variables: MarkReadyForReviewMutationVariables,
            options?: C,
        ): Promise<MarkReadyForReviewMutation> {
            return requester<MarkReadyForReviewMutation, MarkReadyForReviewMutationVariables>(
                MarkReadyForReviewDocument,
                variables,
                options,
            ) as Promise<MarkReadyForReviewMutation>;
        },
        RemoveAssignees(variables: RemoveAssigneesMutationVariables, options?: C): Promise<RemoveAssigneesMutation> {
            return requester<RemoveAssigneesMutation, RemoveAssigneesMutationVariables>(
                RemoveAssigneesDocument,
                variables,
                options,
            ) as Promise<RemoveAssigneesMutation>;
        },
        RemoveLabels(variables: RemoveLabelsMutationVariables, options?: C): Promise<RemoveLabelsMutation> {
            return requester<RemoveLabelsMutation, RemoveLabelsMutationVariables>(
                RemoveLabelsDocument,
                variables,
                options,
            ) as Promise<RemoveLabelsMutation>;
        },
        ReopenIssue(variables: ReopenIssueMutationVariables, options?: C): Promise<ReopenIssueMutation> {
            return requester<ReopenIssueMutation, ReopenIssueMutationVariables>(
                ReopenIssueDocument,
                variables,
                options,
            ) as Promise<ReopenIssueMutation>;
        },
        ReopenPullRequest(
            variables: ReopenPullRequestMutationVariables,
            options?: C,
        ): Promise<ReopenPullRequestMutation> {
            return requester<ReopenPullRequestMutation, ReopenPullRequestMutationVariables>(
                ReopenPullRequestDocument,
                variables,
                options,
            ) as Promise<ReopenPullRequestMutation>;
        },
        RequestReviews(variables: RequestReviewsMutationVariables, options?: C): Promise<RequestReviewsMutation> {
            return requester<RequestReviewsMutation, RequestReviewsMutationVariables>(
                RequestReviewsDocument,
                variables,
                options,
            ) as Promise<RequestReviewsMutation>;
        },
        SetProjectFieldValue(
            variables: SetProjectFieldValueMutationVariables,
            options?: C,
        ): Promise<SetProjectFieldValueMutation> {
            return requester<SetProjectFieldValueMutation, SetProjectFieldValueMutationVariables>(
                SetProjectFieldValueDocument,
                variables,
                options,
            ) as Promise<SetProjectFieldValueMutation>;
        },
        UpdateIssueMilestone(
            variables: UpdateIssueMilestoneMutationVariables,
            options?: C,
        ): Promise<UpdateIssueMilestoneMutation> {
            return requester<UpdateIssueMilestoneMutation, UpdateIssueMilestoneMutationVariables>(
                UpdateIssueMilestoneDocument,
                variables,
                options,
            ) as Promise<UpdateIssueMilestoneMutation>;
        },
        UpdateIssueType(variables: UpdateIssueTypeMutationVariables, options?: C): Promise<UpdateIssueTypeMutation> {
            return requester<UpdateIssueTypeMutation, UpdateIssueTypeMutationVariables>(
                UpdateIssueTypeDocument,
                variables,
                options,
            ) as Promise<UpdateIssueTypeMutation>;
        },
        UpdatePullRequestMilestone(
            variables: UpdatePullRequestMilestoneMutationVariables,
            options?: C,
        ): Promise<UpdatePullRequestMilestoneMutation> {
            return requester<UpdatePullRequestMilestoneMutation, UpdatePullRequestMilestoneMutationVariables>(
                UpdatePullRequestMilestoneDocument,
                variables,
                options,
            ) as Promise<UpdatePullRequestMilestoneMutation>;
        },
    };
}
export type Sdk = ReturnType<typeof getSdk>;
