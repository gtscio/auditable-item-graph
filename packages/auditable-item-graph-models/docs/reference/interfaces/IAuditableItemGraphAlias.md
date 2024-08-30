# Interface: IAuditableItemGraphAlias

Interface describing an alias for a vertex.

## Extends

- [`IAuditableItemGraphAuditedElement`](IAuditableItemGraphAuditedElement.md).[`IAuditableItemGraphMetadataElement`](IAuditableItemGraphMetadataElement.md)

## Properties

### id

> **id**: `string`

The id of the element.

#### Inherited from

[`IAuditableItemGraphAuditedElement`](IAuditableItemGraphAuditedElement.md).[`id`](IAuditableItemGraphAuditedElement.md#id)

***

### created

> **created**: `number`

The timestamp of when the element was created.

#### Inherited from

[`IAuditableItemGraphAuditedElement`](IAuditableItemGraphAuditedElement.md).[`created`](IAuditableItemGraphAuditedElement.md#created)

***

### deleted?

> `optional` **deleted**: `number`

The timestamp of when the element was deleted, as we never actually remove items.
A property can also be marked as deleted if the value was updated, in which case
a new value is created and the old one marked as deleted.

#### Inherited from

[`IAuditableItemGraphAuditedElement`](IAuditableItemGraphAuditedElement.md).[`deleted`](IAuditableItemGraphAuditedElement.md#deleted)

***

### metadata?

> `optional` **metadata**: [`IAuditableItemGraphProperty`](IAuditableItemGraphProperty.md)[]

Metadata to associate with the element.

#### Inherited from

[`IAuditableItemGraphMetadataElement`](IAuditableItemGraphMetadataElement.md).[`metadata`](IAuditableItemGraphMetadataElement.md#metadata)