// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { JsonLdTypes, type IJsonLdNodeObject } from "@twin.org/data-json-ld";
import { entity, property } from "@twin.org/entity";

/**
 * Class describing the auditable item graph vertex resource.
 */
@entity()
export class AuditableItemGraphResource {
	/**
	 * The id of the resource.
	 */
	@property({ type: "string", isPrimary: true })
	public id!: string;

	/**
	 * The timestamp of when the resource was created.
	 */
	@property({ type: "number" })
	public created!: number;

	/**
	 * The timestamp of when the resource was updated.
	 */
	@property({ type: "number" })
	public updated?: number;

	/**
	 * The timestamp of when the resource was deleted, as we never actually remove items.
	 */
	@property({ type: "number" })
	public deleted?: number;

	/**
	 * Metadata to associate with the resource as JSON-LD.
	 */
	@property({ type: "object", itemTypeRef: JsonLdTypes.NodeObject })
	public metadata?: IJsonLdNodeObject;
}
