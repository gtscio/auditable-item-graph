// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ICreatedResponse, IHttpRequestContext, IRestRoute, ITag } from "@gtsc/api-models";
import type {
	IAuditableItemGraphComponent,
	IAuditableItemGraphCreateRequest,
	IAuditableItemGraphGetRequest,
	IAuditableItemGraphGetResponse
} from "@gtsc/auditable-item-graph-models";
import { ComponentFactory, Guards } from "@gtsc/core";
import { nameof } from "@gtsc/nameof";
import { HttpStatusCode } from "@gtsc/web";

/**
 * The source used when communicating about these routes.
 */
const ROUTES_SOURCE = "auditableItemGraphRoutes";

/**
 * The tag to associate with the routes.
 */
export const tagsAuditableItemGraph: ITag[] = [
	{
		name: "Auditable Item Graph",
		description: "Endpoints which are modelled to access an auditable item graph contract."
	}
];

/**
 * The REST routes for auditable item graph.
 * @param baseRouteName Prefix to prepend to the paths.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @returns The generated routes.
 */
export function generateRestRoutesAuditableItemGraph(
	baseRouteName: string,
	componentName: string
): IRestRoute[] {
	const createRoute: IRestRoute<IAuditableItemGraphCreateRequest, ICreatedResponse> = {
		operationId: "auditableItemGraphCreate",
		summary: "Create a new graph vertex",
		tag: tagsAuditableItemGraph[0].name,
		method: "POST",
		path: `${baseRouteName}/`,
		handler: async (httpRequestContext, request) =>
			auditableItemGraphCreate(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IAuditableItemGraphCreateRequest>(),
			examples: [
				{
					id: "auditableItemGraphCreateRequestExample",
					request: {
						body: {}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<ICreatedResponse>()
			}
		]
	};

	const getRoute: IRestRoute<IAuditableItemGraphGetRequest, IAuditableItemGraphGetResponse> = {
		operationId: "auditableItemGraphGet",
		summary: "Get a graph vertex",
		tag: tagsAuditableItemGraph[0].name,
		method: "GET",
		path: `${baseRouteName}/:id`,
		handler: async (httpRequestContext, request) =>
			auditableItemGraphGet(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IAuditableItemGraphGetRequest>(),
			examples: [
				{
					id: "auditableItemGraphGetRequestExample",
					request: {
						pathParams: {
							id: "aig:1234567890"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IAuditableItemGraphGetResponse>(),
				examples: [
					{
						id: "auditableItemGraphGetResponseExample",
						response: {
							body: {
								id: "aig:1234567890",
								created: 1724220078321,
								aliases: [
									{
										created: 1724220078321,
										id: "tst:1234567890"
									}
								],
								metadata: [
									{
										id: "description",
										type: "https://schema.org/Text",
										value: "This is a test item",
										created: 1724220078321
									}
								]
							}
						}
					}
				]
			}
		]
	};

	return [createRoute, getRoute];
}

/**
 * Create the graph vertex.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function auditableItemGraphCreate(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IAuditableItemGraphCreateRequest
): Promise<ICreatedResponse> {
	Guards.object<IAuditableItemGraphCreateRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IAuditableItemGraphCreateRequest["body"]>(
		ROUTES_SOURCE,
		nameof(request.body),
		request.body
	);

	const component = ComponentFactory.get<IAuditableItemGraphComponent>(componentName);
	const id = await component.create(
		request.body.aliases,
		request.body.metadata,
		httpRequestContext.userIdentity,
		httpRequestContext.nodeIdentity
	);
	return {
		statusCode: HttpStatusCode.created,
		headers: {
			location: id
		}
	};
}

/**
 * Get the graph vertex.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function auditableItemGraphGet(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IAuditableItemGraphGetRequest
): Promise<IAuditableItemGraphGetResponse> {
	Guards.object<IAuditableItemGraphGetRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IAuditableItemGraphGetRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(ROUTES_SOURCE, nameof(request.pathParams.id), request.pathParams.id);

	const component = ComponentFactory.get<IAuditableItemGraphComponent>(componentName);
	const result = await component.get(request.pathParams.id, {
		includeDeleted: request.queryParams?.includeDeleted,
		includeChangesets: request.queryParams?.includeChangesets,
		verifySignatureDepth: request.queryParams?.verifySignatureDepth
	});

	return {
		body: result
	};
}
