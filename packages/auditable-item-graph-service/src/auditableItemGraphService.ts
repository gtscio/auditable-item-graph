// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	IAuditableItemGraphAlias,
	IAuditableItemGraphComponent,
	IAuditableItemGraphCredential,
	IAuditableItemGraphEdge,
	IAuditableItemGraphIntegrity,
	IAuditableItemGraphResource,
	IAuditableItemGraphVertex,
	VerifyDepth
} from "@gtsc/auditable-item-graph-models";
import {
	Converter,
	GeneralError,
	Guards,
	Is,
	JsonHelper,
	NotFoundError,
	ObjectHelper,
	RandomHelper,
	Urn,
	type IPatchOperation
} from "@gtsc/core";
import { Blake2b } from "@gtsc/crypto";
import { ComparisonOperator, LogicalOperator, SortDirection } from "@gtsc/entity";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@gtsc/entity-storage-models";
import {
	DocumentHelper,
	IdentityConnectorFactory,
	type IIdentityConnector
} from "@gtsc/identity-models";
import {
	ImmutableStorageConnectorFactory,
	type IImmutableStorageConnector
} from "@gtsc/immutable-storage-models";
import { nameof } from "@gtsc/nameof";
import {
	VaultConnectorFactory,
	VaultEncryptionType,
	type IVaultConnector
} from "@gtsc/vault-models";
import { Jwt } from "@gtsc/web";
import type { AuditableItemGraphAlias } from "./entities/auditableItemGraphAlias";
import type { AuditableItemGraphEdge } from "./entities/auditableItemGraphEdge";
import type { AuditableItemGraphResource } from "./entities/auditableItemGraphResource";
import type { AuditableItemGraphVertex } from "./entities/auditableItemGraphVertex";
import type { IAuditableItemGraphServiceConfig } from "./models/IAuditableItemGraphServiceConfig";
import type { IAuditableItemGraphServiceContext } from "./models/IAuditableItemGraphServiceContext";

/**
 * Class for performing auditable item graph operations.
 */
export class AuditableItemGraphService implements IAuditableItemGraphComponent {
	/**
	 * The namespace for the service.
	 */
	public static readonly NAMESPACE: string = "aig";

	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<AuditableItemGraphService>();

	/**
	 * The configuration for the connector.
	 * @internal
	 */
	private readonly _config: IAuditableItemGraphServiceConfig;

	/**
	 * The vault connector.
	 * @internal
	 */
	private readonly _vaultConnector: IVaultConnector;

	/**
	 * The entity storage for vertices.
	 * @internal
	 */
	private readonly _vertexStorage: IEntityStorageConnector<AuditableItemGraphVertex>;

	/**
	 * The immutable storage for the integrity data.
	 * @internal
	 */
	private readonly _integrityImmutableStorage: IImmutableStorageConnector;

	/**
	 * The identity connector for generating verifiable credentials.
	 * @internal
	 */
	private readonly _identityConnector: IIdentityConnector;

	/**
	 * The vault key for signing or encrypting the data.
	 * @internal
	 */
	private readonly _vaultKeyId: string;

	/**
	 * The assertion method id to use for the graph.
	 * @internal
	 */
	private readonly _assertionMethodId: string;

	/**
	 * Enable immutable integrity checking by storing the changes encrypted in immutable storage.
	 * @internal
	 */
	private readonly _enableIntegrityCheck: boolean;

	/**
	 * Create a new instance of AuditableItemGraphService.
	 * @param options The dependencies for the auditable item graph connector.
	 * @param options.config The configuration for the connector.
	 * @param options.vaultConnectorType The vault connector type, defaults to "vault".
	 * @param options.vertexEntityStorageType The entity storage for vertices, defaults to "auditable-item-graph-vertex".
	 * @param options.integrityImmutableStorageType The immutable storage for audit trail, defaults to "auditable-item-graph".
	 * @param options.identityConnectorType The identity connector type, defaults to "identity".
	 */
	constructor(options?: {
		vaultConnectorType?: string;
		vertexEntityStorageType?: string;
		integrityImmutableStorageType?: string;
		identityConnectorType?: string;
		config?: IAuditableItemGraphServiceConfig;
	}) {
		this._vaultConnector = VaultConnectorFactory.get(options?.vaultConnectorType ?? "vault");

		this._vertexStorage = EntityStorageConnectorFactory.get(
			options?.vertexEntityStorageType ?? "auditable-item-graph-vertex"
		);

		this._integrityImmutableStorage = ImmutableStorageConnectorFactory.get(
			options?.integrityImmutableStorageType ?? "auditable-item-graph"
		);

		this._identityConnector = IdentityConnectorFactory.get(
			options?.identityConnectorType ?? "identity"
		);

		this._config = options?.config ?? {};
		this._vaultKeyId = this._config.vaultKeyId ?? "auditable-item-graph";
		this._assertionMethodId = this._config.assertionMethodId ?? "auditable-item-graph";
		this._enableIntegrityCheck = this._config.enableIntegrityCheck ?? false;
	}

	/**
	 * Create a new graph vertex.
	 * @param metadataSchema The metadata schema for the vertex.
	 * @param metadata The metadata for the vertex.
	 * @param aliases Alternative aliases that can be used to identify the vertex.
	 * @param resources The resources attached to the vertex.
	 * @param edges The edges connected to the vertex.
	 * @param identity The identity to create the auditable item graph operation with.
	 * @param nodeIdentity The node identity to include in the auditable item graph.
	 * @returns The id of the new graph item.
	 */
	public async create(
		metadataSchema?: string,
		metadata?: unknown,
		aliases?: {
			id: string;
			metadataSchema?: string;
			metadata?: unknown;
		}[],
		resources?: {
			id: string;
			metadataSchema?: string;
			metadata?: unknown;
		}[],
		edges?: {
			id: string;
			relationship: string;
			metadataSchema?: string;
			metadata?: unknown;
		}[],
		identity?: string,
		nodeIdentity?: string
	): Promise<string> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);
		Guards.stringValue(this.CLASS_NAME, nameof(nodeIdentity), nodeIdentity);

		try {
			const id = Converter.bytesToHex(RandomHelper.generate(32), false);

			const context: IAuditableItemGraphServiceContext = {
				now: Date.now(),
				userIdentity: identity,
				nodeIdentity
			};

			const vertexModel: IAuditableItemGraphVertex = {
				id,
				nodeIdentity,
				created: context.now,
				updated: context.now
			};
			const originalModel = ObjectHelper.clone(vertexModel);

			vertexModel.metadataSchema = metadataSchema;
			vertexModel.metadata = metadata;

			this.updateAliasList(context, vertexModel, aliases);
			this.updateResourceList(context, vertexModel, resources);
			this.updateEdgeList(context, vertexModel, edges);

			await this.addChangeset(context, originalModel, vertexModel);

			await this._vertexStorage.set(this.vertexModelToEntity(vertexModel));

			return new Urn(AuditableItemGraphService.NAMESPACE, id).toString();
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "createFailed", undefined, error);
		}
	}

	/**
	 * Get a graph vertex.
	 * @param id The id of the vertex to get.
	 * @returns The vertex if found.
	 * @param options Additional options for the get operation.
	 * @param options.includeDeleted Whether to include deleted/updated aliases, resource, edges, defaults to false.
	 * @param options.includeChangesets Whether to include the changesets of the vertex, defaults to false.
	 * @param options.verifySignatureDepth How many signatures to verify, defaults to "none".
	 * @throws NotFoundError if the vertex is not found.
	 */
	public async get(
		id: string,
		options?: {
			includeDeleted?: boolean;
			includeChangesets?: boolean;
			verifySignatureDepth?: VerifyDepth;
		}
	): Promise<{
		verified?: boolean;
		verification?: {
			created: number;
			patches: IPatchOperation[];
			failure?: string;
			failureProperties?: { [id: string]: unknown };
		}[];
		vertex: IAuditableItemGraphVertex;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(id), id);

		const urnParsed = Urn.fromValidString(id);

		if (urnParsed.namespaceIdentifier() !== AuditableItemGraphService.NAMESPACE) {
			throw new GeneralError(this.CLASS_NAME, "namespaceMismatch", {
				namespace: AuditableItemGraphService.NAMESPACE,
				id
			});
		}

		try {
			const vertexId = urnParsed.namespaceSpecific(0);
			const vertexEntity = await this._vertexStorage.get(vertexId);

			if (Is.empty(vertexEntity)) {
				throw new NotFoundError(this.CLASS_NAME, "vertexNotFound", id);
			}

			const vertexModel = this.vertexEntityToModel(vertexEntity);

			let verified: boolean | undefined;
			let verification:
				| {
						created: number;
						patches: IPatchOperation[];
						failure?: string;
						failureProperties?: { [id: string]: unknown };
				  }[]
				| undefined;

			if (options?.verifySignatureDepth === "current" || options?.verifySignatureDepth === "all") {
				const verifyResult = await this.verifyChangesets(vertexModel, options.verifySignatureDepth);
				verified = verifyResult.verified;
				verification = verifyResult.verification;
			}

			if (!(options?.includeDeleted ?? false)) {
				if (Is.arrayValue(vertexModel.aliases)) {
					vertexModel.aliases = vertexModel.aliases.filter(a => Is.undefined(a.deleted));
					if (vertexModel.aliases.length === 0) {
						delete vertexModel.aliases;
					}
				}
				if (Is.arrayValue(vertexModel.resources)) {
					vertexModel.resources = vertexModel.resources.filter(r => Is.undefined(r.deleted));
					if (vertexModel.resources.length === 0) {
						delete vertexModel.resources;
					}
				}
				if (Is.arrayValue(vertexModel.edges)) {
					vertexModel.edges = vertexModel.edges.filter(r => Is.undefined(r.deleted));
					if (vertexModel.edges.length === 0) {
						delete vertexModel.edges;
					}
				}
			}

			if (!(options?.includeChangesets ?? false)) {
				delete vertexModel.changesets;
			}

			return {
				verified,
				verification,
				vertex: vertexModel
			};
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "getFailed", undefined, error);
		}
	}

	/**
	 * Update a graph vertex.
	 * @param id The id of the vertex to update.
	 * @param metadataSchema The metadata schema for the vertex.
	 * @param metadata The metadata for the vertex.
	 * @param aliases Alternative aliases that can be used to identify the vertex.
	 * @param resources The resources attached to the vertex.
	 * @param edges The edges connected to the vertex.
	 * @param identity The identity to create the auditable item graph operation with.
	 * @param nodeIdentity The node identity to include in the auditable item graph.
	 * @returns Nothing.
	 */
	public async update(
		id: string,
		metadataSchema?: string,
		metadata?: unknown,
		aliases?: {
			id: string;
			metadataSchema?: string;
			metadata?: unknown;
		}[],
		resources?: {
			id: string;
			metadataSchema?: string;
			metadata?: unknown;
		}[],
		edges?: {
			id: string;
			relationship: string;
			metadataSchema?: string;
			metadata?: unknown;
		}[],
		identity?: string,
		nodeIdentity?: string
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(id), id);
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);
		Guards.stringValue(this.CLASS_NAME, nameof(nodeIdentity), nodeIdentity);

		const urnParsed = Urn.fromValidString(id);

		if (urnParsed.namespaceIdentifier() !== AuditableItemGraphService.NAMESPACE) {
			throw new GeneralError(this.CLASS_NAME, "namespaceMismatch", {
				namespace: AuditableItemGraphService.NAMESPACE,
				id
			});
		}

		try {
			const vertexId = urnParsed.namespaceSpecific(0);
			const vertexEntity = await this._vertexStorage.get(vertexId);

			if (Is.empty(vertexEntity)) {
				throw new NotFoundError(this.CLASS_NAME, "vertexNotFound", id);
			}

			const context: IAuditableItemGraphServiceContext = {
				now: Date.now(),
				userIdentity: identity,
				nodeIdentity
			};

			const vertexModel = this.vertexEntityToModel(vertexEntity);
			const originalModel = ObjectHelper.clone(vertexModel);
			vertexModel.metadataSchema = metadataSchema;
			vertexModel.metadata = metadata;

			this.updateAliasList(context, vertexModel, aliases);
			this.updateResourceList(context, vertexModel, resources);
			this.updateEdgeList(context, vertexModel, edges);

			const changes = await this.addChangeset(context, originalModel, vertexModel);

			if (changes) {
				vertexModel.updated = context.now;
				await this._vertexStorage.set(this.vertexModelToEntity(vertexModel));
			}
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "updateFailed", undefined, error);
		}
	}

	/**
	 * Remove the immutable storage for an item.
	 * @param id The id of the vertex to get.
	 * @param nodeIdentity The node identity to use for vault operations.
	 * @returns Nothing.
	 * @throws NotFoundError if the vertex is not found.
	 */
	public async removeImmutable(id: string, nodeIdentity?: string): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(id), id);
		Guards.stringValue(this.CLASS_NAME, nameof(nodeIdentity), nodeIdentity);

		const urnParsed = Urn.fromValidString(id);

		if (urnParsed.namespaceIdentifier() !== AuditableItemGraphService.NAMESPACE) {
			throw new GeneralError(this.CLASS_NAME, "namespaceMismatch", {
				namespace: AuditableItemGraphService.NAMESPACE,
				id
			});
		}

		try {
			const vertexId = urnParsed.namespaceSpecific(0);
			const vertexEntity = await this._vertexStorage.get(vertexId);

			if (Is.empty(vertexEntity)) {
				throw new NotFoundError(this.CLASS_NAME, "vertexNotFound", id);
			}

			let hasChanged = false;

			if (Is.arrayValue(vertexEntity.changesets)) {
				for (const changeset of vertexEntity.changesets) {
					if (Is.stringValue(changeset.immutableStorageId)) {
						await this._integrityImmutableStorage.remove(
							nodeIdentity,
							changeset.immutableStorageId
						);
						delete changeset.immutableStorageId;
						hasChanged = true;
					}
				}
			}

			if (hasChanged) {
				await this._vertexStorage.set(vertexEntity);
			}
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "removeImmutableFailed", undefined, error);
		}
	}

	/**
	 * Query the graph for vertices.
	 * @param options The query options.
	 * @param options.id The optional id to look for.
	 * @param options.idMode Look in id, alias or both, defaults to both.
	 * @param orderBy The order for the results, defaults to created.
	 * @param orderByDirection The direction for the order, defaults to desc.
	 * @param properties The properties to return, if not provided defaults to id, created, aliases and metadata.
	 * @param cursor The cursor to request the next page of entities.
	 * @param pageSize The maximum number of entities in a page.
	 * @returns The entities, which can be partial if a limited keys list was provided.
	 */
	public async query(
		options?: {
			id?: string;
			idMode?: "id" | "alias" | "both";
		},
		orderBy?: "created" | "updated",
		orderByDirection?: SortDirection,
		properties?: (keyof IAuditableItemGraphVertex)[],
		cursor?: string,
		pageSize?: number
	): Promise<{
		/**
		 * The entities, which can be partial if a limited keys list was provided.
		 */
		entities: Partial<IAuditableItemGraphVertex>[];
		/**
		 * An optional cursor, when defined can be used to call find to get more entities.
		 */
		cursor?: string;
		/**
		 * Number of entities to return.
		 */
		pageSize?: number;
		/**
		 * Total entities length.
		 */
		totalEntities: number;
	}> {
		try {
			const propertiesToReturn = properties ?? ["id", "created", "aliases", "metadata"];
			const conditions = [];
			const orderProperty = orderBy ?? "created";
			const orderDirection = orderByDirection ?? SortDirection.Descending;

			const idOrAlias = options?.id;
			if (Is.stringValue(idOrAlias)) {
				const idMode = options?.idMode ?? "both";
				if (idMode === "id" || idMode === "both") {
					conditions.push({
						property: "id",
						comparison: ComparisonOperator.Includes,
						value: idOrAlias
					});
				}
				if (idMode === "alias" || idMode === "both") {
					conditions.push({
						property: "aliasIndex",
						comparison: ComparisonOperator.Includes,
						value: idOrAlias.toLowerCase()
					});
				}
			}

			if (!propertiesToReturn.includes("id")) {
				propertiesToReturn.unshift("id");
			}

			const results = await this._vertexStorage.query(
				conditions.length > 0
					? {
							conditions,
							logicalOperator: LogicalOperator.Or
						}
					: undefined,
				[
					{
						property: orderProperty,
						sortDirection: orderDirection
					}
				],
				propertiesToReturn as (keyof AuditableItemGraphVertex)[],
				cursor,
				pageSize
			);

			return {
				entities: (results.entities as AuditableItemGraphVertex[]).map(e =>
					this.vertexEntityToModel(e)
				),
				cursor: results.cursor,
				pageSize: results.pageSize,
				totalEntities: results.totalEntities
			};
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "queryingFailed", undefined, error);
		}
	}

	/**
	 * Map the vertex model to an entity.
	 * @param vertexModel The vertex model.
	 * @returns The entity.
	 * @internal
	 */
	private vertexModelToEntity(vertexModel: IAuditableItemGraphVertex): AuditableItemGraphVertex {
		const entity: AuditableItemGraphVertex = {
			id: vertexModel.id,
			created: vertexModel.created,
			updated: vertexModel.updated,
			nodeIdentity: vertexModel.nodeIdentity,
			metadataSchema: vertexModel.metadataSchema,
			metadata: vertexModel.metadata
		};

		if (Is.arrayValue(vertexModel.aliases)) {
			const aliasIndex = [];
			entity.aliases ??= [];
			for (const aliasModel of vertexModel.aliases) {
				const aliasEntity: AuditableItemGraphAlias = {
					id: aliasModel.id,
					created: aliasModel.created,
					deleted: aliasModel.deleted,
					metadataSchema: aliasModel.metadataSchema,
					metadata: aliasModel.metadata
				};
				entity.aliases.push(aliasEntity);
				aliasIndex.push(aliasModel.id);
			}
			entity.aliasIndex = aliasIndex.join("||").toLowerCase();
		}

		if (Is.arrayValue(vertexModel.resources)) {
			entity.resources ??= [];
			for (const resourceModel of vertexModel.resources) {
				const resourceEntity: AuditableItemGraphResource = {
					id: resourceModel.id,
					created: resourceModel.created,
					deleted: resourceModel.deleted,
					metadataSchema: resourceModel.metadataSchema,
					metadata: resourceModel.metadata
				};
				entity.resources.push(resourceEntity);
			}
		}

		if (Is.arrayValue(vertexModel.edges)) {
			entity.edges ??= [];
			for (const edgeModel of vertexModel.edges) {
				const edgeEntity: AuditableItemGraphEdge = {
					id: edgeModel.id,
					created: edgeModel.created,
					deleted: edgeModel.deleted,
					relationship: edgeModel.relationship,
					metadataSchema: edgeModel.metadataSchema,
					metadata: edgeModel.metadata
				};
				entity.edges.push(edgeEntity);
			}
		}

		if (Is.arrayValue(vertexModel.changesets)) {
			entity.changesets ??= [];
			for (const changeset of vertexModel.changesets) {
				entity.changesets.push({
					created: changeset.created,
					userIdentity: changeset.userIdentity,
					patches: changeset.patches,
					hash: changeset.hash,
					immutableStorageId: changeset.immutableStorageId
				});
			}
		}

		return entity;
	}

	/**
	 * Map the vertex entity to a model.
	 * @param vertexEntity The vertex entity.
	 * @returns The model.
	 * @internal
	 */
	private vertexEntityToModel(vertexEntity: AuditableItemGraphVertex): IAuditableItemGraphVertex {
		const model: IAuditableItemGraphVertex = {
			id: vertexEntity.id,
			created: vertexEntity.created,
			updated: vertexEntity.updated,
			nodeIdentity: vertexEntity.nodeIdentity,
			metadataSchema: vertexEntity.metadataSchema,
			metadata: vertexEntity.metadata
		};

		if (Is.arrayValue(vertexEntity.aliases)) {
			model.aliases ??= [];
			for (const aliasEntity of vertexEntity.aliases) {
				const aliasModel: IAuditableItemGraphAlias = {
					id: aliasEntity.id,
					created: aliasEntity.created,
					deleted: aliasEntity.deleted,
					metadataSchema: aliasEntity.metadataSchema,
					metadata: aliasEntity.metadata
				};
				model.aliases.push(aliasModel);
			}
		}

		if (Is.arrayValue(vertexEntity.resources)) {
			model.resources ??= [];
			for (const resourceEntity of vertexEntity.resources) {
				const resourceModel: IAuditableItemGraphResource = {
					id: resourceEntity.id,
					created: resourceEntity.created,
					deleted: resourceEntity.deleted,
					metadataSchema: resourceEntity.metadataSchema,
					metadata: resourceEntity.metadata
				};
				model.resources.push(resourceModel);
			}
		}

		if (Is.arrayValue(vertexEntity.edges)) {
			model.edges ??= [];
			for (const edgeEntity of vertexEntity.edges) {
				const edgeModel: IAuditableItemGraphEdge = {
					id: edgeEntity.id,
					created: edgeEntity.created,
					deleted: edgeEntity.deleted,
					relationship: edgeEntity.relationship,
					metadataSchema: edgeEntity.metadataSchema,
					metadata: edgeEntity.metadata
				};
				model.edges.push(edgeModel);
			}
		}

		if (Is.arrayValue(vertexEntity.changesets)) {
			model.changesets ??= [];
			for (const changeset of vertexEntity.changesets) {
				model.changesets.push({
					created: changeset.created,
					userIdentity: changeset.userIdentity,
					patches: changeset.patches,
					hash: changeset.hash,
					immutableStorageId: changeset.immutableStorageId
				});
			}
		}

		return model;
	}

	/**
	 * Update the aliases of a vertex model.
	 * @param context The context for the operation.
	 * @param vertexModel The vertex model.
	 * @param aliases The aliases to update.
	 * @internal
	 */
	private updateAliasList(
		context: IAuditableItemGraphServiceContext,
		vertexModel: IAuditableItemGraphVertex,
		aliases?: {
			id: string;
			metadataSchema?: string;
			metadata?: unknown;
		}[]
	): void {
		const active = vertexModel.aliases?.filter(a => Is.empty(a.deleted)) ?? [];

		// The active aliases that are not in the update list should be marked as deleted.
		if (Is.arrayValue(active)) {
			for (const alias of active) {
				if (!aliases?.find(a => a.id === alias.id)) {
					alias.deleted = context.now;
				}
			}
		}

		if (Is.arrayValue(aliases)) {
			for (const alias of aliases) {
				this.updateAlias(context, vertexModel, alias);
			}
		}
	}

	/**
	 * Update an alias in the vertex model.
	 * @param context The context for the operation.
	 * @param vertexModel The vertex model.
	 * @param alias The alias.
	 * @internal
	 */
	private updateAlias(
		context: IAuditableItemGraphServiceContext,
		vertexModel: IAuditableItemGraphVertex,
		alias: {
			id: string;
			metadataSchema?: string;
			metadata?: unknown;
		}
	): void {
		Guards.object(this.CLASS_NAME, nameof(alias), alias);
		Guards.stringValue(this.CLASS_NAME, nameof(alias.id), alias.id);

		// Try to find an existing alias with the same id.
		const existing = vertexModel.aliases?.find(a => a.id === alias.id);

		if (Is.empty(existing) || existing?.deleted) {
			// Did not find a matching item, or found one which is deleted.
			vertexModel.aliases ??= [];

			const model: IAuditableItemGraphAlias = {
				id: alias.id,
				created: context.now,
				metadataSchema: alias.metadataSchema,
				metadata: alias.metadata
			};

			vertexModel.aliases.push(model);
		} else if (
			existing.metadataSchema !== alias.metadataSchema ||
			JsonHelper.canonicalize(existing.metadata) !== JsonHelper.canonicalize(alias.metadata)
		) {
			// Existing alias found, update the metadata.
			existing.updated = context.now;
			existing.metadataSchema = alias.metadataSchema;
			existing.metadata = alias.metadata;
		}
	}

	/**
	 * Update the resources of a vertex model.
	 * @param context The context for the operation.
	 * @param vertexModel The vertex model.
	 * @param resources The resources to update.
	 * @internal
	 */
	private updateResourceList(
		context: IAuditableItemGraphServiceContext,
		vertexModel: IAuditableItemGraphVertex,
		resources?: {
			id: string;
			metadataSchema?: string;
			metadata?: unknown;
		}[]
	): void {
		const active = vertexModel.resources?.filter(r => Is.empty(r.deleted)) ?? [];

		// The active resources that are not in the update list should be marked as deleted.
		if (Is.arrayValue(active)) {
			for (const resource of active) {
				if (!resources?.find(a => a.id === resource.id)) {
					resource.deleted = context.now;
				}
			}
		}

		if (Is.arrayValue(resources)) {
			for (const resource of resources) {
				this.updateResource(context, vertexModel, resource);
			}
		}
	}

	/**
	 * Add a resource to the vertex model.
	 * @param context The context for the operation.
	 * @param vertexModel The vertex model.
	 * @param resource The resource.
	 * @internal
	 */
	private updateResource(
		context: IAuditableItemGraphServiceContext,
		vertexModel: IAuditableItemGraphVertex,
		resource: {
			id: string;
			metadataSchema?: string;
			metadata?: unknown;
		}
	): void {
		Guards.object(this.CLASS_NAME, nameof(resource), resource);
		Guards.stringValue(this.CLASS_NAME, nameof(resource.id), resource.id);

		// Try to find an existing resource with the same id.
		const existing = vertexModel.resources?.find(r => r.id === resource.id);

		if (Is.empty(existing) || existing?.deleted) {
			// Did not find a matching item, or found one which is deleted.
			vertexModel.resources ??= [];

			const model: IAuditableItemGraphResource = {
				id: resource.id,
				created: context.now,
				metadataSchema: resource.metadataSchema,
				metadata: resource.metadata
			};

			vertexModel.resources.push(model);
		} else if (
			existing.metadataSchema !== resource.metadataSchema ||
			JsonHelper.canonicalize(existing.metadata) !== JsonHelper.canonicalize(resource.metadata)
		) {
			// Existing resource found, update the metadata.
			existing.updated = context.now;
			existing.metadataSchema = resource.metadataSchema;
			existing.metadata = resource.metadata;
		}
	}

	/**
	 * Update the edges of a vertex model.
	 * @param context The context for the operation.
	 * @param vertexModel The vertex model.
	 * @param edges The edges to update.
	 * @internal
	 */
	private updateEdgeList(
		context: IAuditableItemGraphServiceContext,
		vertexModel: IAuditableItemGraphVertex,
		edges?: {
			id: string;
			relationship: string;
			metadataSchema?: string;
			metadata?: unknown;
		}[]
	): void {
		const active = vertexModel.edges?.filter(e => Is.empty(e.deleted)) ?? [];

		// The active edges that are not in the update list should be marked as deleted.
		if (Is.arrayValue(active)) {
			for (const edge of active) {
				if (!edges?.find(a => a.id === edge.id)) {
					edge.deleted = context.now;
				}
			}
		}

		if (Is.arrayValue(edges)) {
			for (const edge of edges) {
				this.updateEdge(context, vertexModel, edge);
			}
		}
	}

	/**
	 * Add an edge to the vertex model.
	 * @param context The context for the operation.
	 * @param vertexModel The vertex model.
	 * @param edge The edge.
	 * @internal
	 */
	private updateEdge(
		context: IAuditableItemGraphServiceContext,
		vertexModel: IAuditableItemGraphVertex,
		edge: {
			id: string;
			relationship: string;
			metadataSchema?: string;
			metadata?: unknown;
		}
	): void {
		Guards.object(this.CLASS_NAME, nameof(edge), edge);
		Guards.stringValue(this.CLASS_NAME, nameof(edge.id), edge.id);
		Guards.stringValue(this.CLASS_NAME, nameof(edge.relationship), edge.relationship);

		// Try to find an existing edge with the same id.
		const existing = vertexModel.edges?.find(r => r.id === edge.id);

		if (Is.empty(existing) || existing?.deleted) {
			// Did not find a matching item, or found one which is deleted.
			vertexModel.edges ??= [];

			const model: IAuditableItemGraphEdge = {
				id: edge.id,
				created: context.now,
				metadataSchema: edge.metadataSchema,
				metadata: edge.metadata,
				relationship: edge.relationship
			};

			vertexModel.edges.push(model);
		} else if (
			existing.relationship !== edge.relationship ||
			existing.metadataSchema !== edge.metadataSchema ||
			JsonHelper.canonicalize(existing.metadata) !== JsonHelper.canonicalize(edge.metadata)
		) {
			// Existing resource found, update the metadata.
			existing.updated = context.now;
			existing.relationship = edge.relationship;
			existing.metadataSchema = edge.metadataSchema;
			existing.metadata = edge.metadata;
		}
	}

	/**
	 * Add a changeset to the vertex and generate the associated verifications.
	 * @param context The context for the operation.
	 * @param vertex The vertex model.
	 * @returns True if there were changes.
	 * @internal
	 */
	private async addChangeset(
		context: IAuditableItemGraphServiceContext,
		originalModel: IAuditableItemGraphVertex,
		updatedModel: IAuditableItemGraphVertex
	): Promise<boolean> {
		const patches = JsonHelper.diff(originalModel, updatedModel);

		const changeSets = originalModel.changesets ?? [];

		if (patches.length > 0 || changeSets.length === 0) {
			const b2b = new Blake2b(Blake2b.SIZE_256);

			// If there are previous changesets, add the most recent one to the new hash.
			// This provides a link to previous integrity checks.
			if (changeSets.length > 0) {
				b2b.update(Converter.base64ToBytes(changeSets[changeSets.length - 1].hash));
			}

			// Add the epoch and the identity in to the signature
			b2b.update(Converter.utf8ToBytes(context.now.toString()));
			b2b.update(Converter.utf8ToBytes(context.userIdentity));

			// Add the patch operations to the hash.
			b2b.update(ObjectHelper.toBytes(patches));

			const changeSetHash = b2b.digest();

			// Generate the signature for the changeset using the hash.
			const signature = await this._vaultConnector.sign(
				`${context.nodeIdentity}/${this._vaultKeyId}`,
				changeSetHash
			);

			// Create the data for the verifiable credential
			const credentialData: IAuditableItemGraphCredential = {
				signature: Converter.bytesToBase64(signature)
			};

			// If integrity check is enabled add an encrypted version of the changes to the credential data.
			if (this._enableIntegrityCheck) {
				const integrityData: IAuditableItemGraphIntegrity = {
					created: context.now,
					userIdentity: context.userIdentity,
					patches
				};
				const canonical = JsonHelper.canonicalize(integrityData);
				const encrypted = await this._vaultConnector.encrypt(
					`${context.nodeIdentity}/${this._vaultKeyId}`,
					VaultEncryptionType.ChaCha20Poly1305,
					Converter.utf8ToBytes(canonical)
				);

				credentialData.integrity = Converter.bytesToBase64(encrypted);
			}

			// Create the verifiable credential
			const verifiableCredential = await this._identityConnector.createVerifiableCredential(
				context.nodeIdentity,
				`${context.nodeIdentity}#${this._assertionMethodId}`,
				undefined,
				"AuditableItemGraphIntegrity",
				credentialData
			);

			// Store the verifiable credential immutably
			const immutableStorageId = await this._integrityImmutableStorage.store(
				context.nodeIdentity,
				Converter.utf8ToBytes(verifiableCredential.jwt)
			);

			// Link the immutable storage id to the changeset
			changeSets.push({
				created: context.now,
				userIdentity: context.userIdentity,
				patches,
				hash: Converter.bytesToBase64(changeSetHash),
				immutableStorageId
			});

			updatedModel.changesets = changeSets;

			return true;
		}

		return false;
	}

	/**
	 * Verify the changesets of a vertex.
	 * @param nodeIdentity The node identity to verify the changesets with.
	 * @param vertex The vertex to verify.
	 * @param verifySignatureDepth How many signatures to verify.
	 * @internal
	 */
	private async verifyChangesets(
		vertex: IAuditableItemGraphVertex,
		verifySignatureDepth: Omit<VerifyDepth, "none">
	): Promise<{
		verified?: boolean;
		verification?: {
			created: number;
			patches: IPatchOperation[];
			failure?: string;
			failureProperties?: { [id: string]: unknown };
		}[];
	}> {
		let verified: boolean = true;
		const verification: {
			created: number;
			patches: IPatchOperation[];
			failure?: string;
			failureProperties?: { [id: string]: unknown };
		}[] = [];

		if (Is.arrayValue(vertex.changesets)) {
			let lastHash: Uint8Array | undefined;
			for (let i = 0; i < vertex.changesets.length; i++) {
				const calculatedChangeset = vertex.changesets[i];

				const verify: {
					created: number;
					patches: IPatchOperation[];
					failure?: string;
					failureProperties?: { [id: string]: unknown };
				} = {
					created: vertex.changesets[i].created,
					patches: calculatedChangeset.patches
				};

				verification.push(verify);

				const b2b = new Blake2b(Blake2b.SIZE_256);
				// Add the last hash if there is one
				if (Is.uint8Array(lastHash)) {
					b2b.update(lastHash);
				}
				// Add the epoch and the identity in to the signature
				b2b.update(Converter.utf8ToBytes(calculatedChangeset.created.toString()));
				b2b.update(Converter.utf8ToBytes(calculatedChangeset.userIdentity));

				// Add the patch operations to the hash.
				b2b.update(ObjectHelper.toBytes(calculatedChangeset.patches));

				const verifyHash = b2b.digest();

				lastHash = verifyHash;

				if (Converter.bytesToBase64(verifyHash) !== calculatedChangeset.hash) {
					verify.failure = "invalidChangesetHash";
				} else if (
					verifySignatureDepth === "all" ||
					(verifySignatureDepth === "current" && i === vertex.changesets.length - 1)
				) {
					let integrityPatches: IPatchOperation[] | undefined;
					let integrityNodeIdentity: string | undefined;
					let integrityUserIdentity: string | undefined;

					// Create the signature for the local changeset
					const changesetSignature = await this._vaultConnector.sign(
						`${vertex.nodeIdentity}/${this._vaultKeyId}`,
						verifyHash
					);

					if (Is.stringValue(calculatedChangeset.immutableStorageId)) {
						// Get the vc from the immutable data store
						const verifiableCredentialBytes = await this._integrityImmutableStorage.get(
							calculatedChangeset.immutableStorageId
						);
						const verifiableCredentialJwt = Converter.bytesToUtf8(verifiableCredentialBytes);
						const decodedJwt = await Jwt.decode(verifiableCredentialJwt);

						// Verify the credential
						const verificationResult =
							await this._identityConnector.checkVerifiableCredential<IAuditableItemGraphCredential>(
								verifiableCredentialJwt
							);

						if (verificationResult.revoked) {
							verify.failure = "changesetCredentialRevoked";
						} else {
							// Credential is not revoked so check the signature
							const credentialData = Is.array(
								verificationResult.verifiableCredential?.credentialSubject
							)
								? verificationResult.verifiableCredential?.credentialSubject[0]
								: verificationResult.verifiableCredential?.credentialSubject ?? {
										signature: ""
									};

							integrityNodeIdentity = DocumentHelper.parse(decodedJwt.header?.kid ?? "").id;

							// Does the immutable signature match the local one we calculated
							if (credentialData.signature !== Converter.bytesToBase64(changesetSignature)) {
								verify.failure = "invalidChangesetSignature";
							} else if (Is.stringValue(credentialData.integrity)) {
								const decrypted = await this._vaultConnector.decrypt(
									`${vertex.nodeIdentity}/${this._vaultKeyId}`,
									VaultEncryptionType.ChaCha20Poly1305,
									Converter.base64ToBytes(credentialData.integrity)
								);

								const canonical = Converter.bytesToUtf8(decrypted);
								const calculatedIntegrity: IAuditableItemGraphIntegrity = {
									created: calculatedChangeset.created,
									userIdentity: calculatedChangeset.userIdentity,
									patches: calculatedChangeset.patches
								};
								if (canonical !== JsonHelper.canonicalize(calculatedIntegrity)) {
									verify.failure = "invalidChangesetCanonical";
								}
								const changesAndIdentity: IAuditableItemGraphIntegrity = JSON.parse(canonical);
								integrityPatches = changesAndIdentity.patches;
								integrityUserIdentity = changesAndIdentity.userIdentity;
							}
						}
					}

					// If there was a failure add some additional information
					if (Is.stringValue(verify.failure)) {
						verify.failureProperties = {
							hash: calculatedChangeset.hash,
							epoch: calculatedChangeset.created,
							calculatedChangeset,
							integrityChangeset: integrityPatches,
							integrityNodeIdentity,
							integrityUserIdentity
						};
						verified = false;
					}
				}
			}
		}

		return {
			verified,
			verification
		};
	}
}
