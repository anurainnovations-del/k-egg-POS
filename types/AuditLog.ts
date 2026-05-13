import { Timestamp } from "firebase/firestore";

export type AuditAction = 
  | "STOCK_UPDATE" 
  | "STOCK_ADJUSTMENT"
  | "ENTITY_CREATE"
  | "ENTITY_EDIT"
  | "ENTITY_DELETE"
  | "PRICE_EDIT" 
  | "AVAILABILITY_TOGGLE"
  | "ORDER_COMPLETED"
  | "ORDER_VOIDED"
  | "DISCOUNT_CREATE"
  | "DISCOUNT_EDIT"
  | "USER_ROLE_UPDATE"
  | "USER_DELETE";

export type EntityType = 
  | "ingredient" 
  | "menuItem" 
  | "order" 
  | "user" 
  | "discount";

export interface AuditLog {
  id: string;
  branchId: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  details: {
    before?: any;
    after?: any;
    message?: string;
  };
  timestamp: Timestamp;
}
