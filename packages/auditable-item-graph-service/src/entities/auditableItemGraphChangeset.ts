// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { entity, property, SortDirection } from "@gtsc/entity";
import type { AuditableItemGraphPatch } from "./auditableItemGraphPatch";

/**
 * Class describing a set of updates to the vertex.
 */
@entity()
export class AuditableItemGraphChangeset {
	/**
	 * The hash of the changeset.
	 */
	@property({ type: "string", isPrimary: true })
	public hash!: string;

	/**
	 * The vertex the changeset belongs to.
	 */
	@property({ type: "string", isSecondary: true })
	public vertexId!: string;

	/**
	 * The timestamp of when the changeset was created.
	 */
	@property({ type: "number", sortDirection: SortDirection.Ascending })
	public created!: number;

	/**
	 * The identity of the user who made the changeset.
	 */
	@property({ type: "string" })
	public userIdentity!: string;

	/**
	 * The patches in the changeset.
	 */
	@property({ type: "array", itemTypeRef: "AuditableItemGraphPatch" })
	public patches!: AuditableItemGraphPatch[];

	/**
	 * The immutable storage id which contains the signature for this changeset.
	 */
	@property({ type: "string" })
	public immutableStorageId?: string;
}
