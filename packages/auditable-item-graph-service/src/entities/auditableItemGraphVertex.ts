// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { JsonLdTypes, type IJsonLdNodeObject } from "@twin.org/data-json-ld";
import { entity, property, SortDirection } from "@twin.org/entity";
import type { AuditableItemGraphAlias } from "./auditableItemGraphAlias";
import type { AuditableItemGraphEdge } from "./auditableItemGraphEdge";
import type { AuditableItemGraphResource } from "./auditableItemGraphResource";

/**
 * Class describing the auditable item graph vertex.
 */
@entity()
export class AuditableItemGraphVertex {
	/**
	 * The id of the vertex.
	 */
	@property({ type: "string", isPrimary: true })
	public id!: string;

	/**
	 * The identity of the node which controls the vertex.
	 */
	@property({ type: "string" })
	public nodeIdentity?: string;

	/**
	 * The date/time of when the vertex was created.
	 */
	@property({ type: "string", format: "date-time", sortDirection: SortDirection.Descending })
	public dateCreated!: string;

	/**
	 * The date/time of when the vertex was last modified.
	 */
	@property({ type: "string", format: "date-time", sortDirection: SortDirection.Descending })
	public dateModified?: string;

	/**
	 * Combined alias index for the vertex used for querying.
	 */
	@property({ type: "string", isSecondary: true })
	public aliasIndex?: string;

	/**
	 * Object to associate with the vertex as JSON-LD.
	 */
	@property({ type: "object", itemTypeRef: JsonLdTypes.NodeObject })
	public vertexObject?: IJsonLdNodeObject;

	/**
	 * Alternative aliases that can be used to identify the vertex.
	 */
	@property({ type: "array", itemType: "string" })
	public aliases?: AuditableItemGraphAlias[];

	/**
	 * The resources attached to the vertex.
	 */
	@property({ type: "array", itemTypeRef: "AuditableItemGraphResource" })
	public resources?: AuditableItemGraphResource[];

	/**
	 * Edges connected to the vertex.
	 */
	@property({ type: "array", itemTypeRef: "AuditableItemGraphEdge" })
	public edges?: AuditableItemGraphEdge[];
}
