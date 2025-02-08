import { Request, Response, Router } from "express";
import prisma from "../src/client";
import { foodControllers } from "./controllers/food_controllers";
import { userControllers } from "./controllers/user_controllers";
import { orderControllers } from "./controllers/order_controllers";

const router = Router();
router.post("/user/register", (req: Request, res: Response) => userControllers.register(req, res, prisma));
router.post("/user/login", (req: Request, res: Response) => userControllers.login(req, res, prisma));
router.get("/food", (req: Request, res: Response) => foodControllers.getFood(res, prisma));
router.put("/food", (req: Request, res: Response) => foodControllers.modifyFood(req, res, prisma));
router.post("/order", (req: Request, res: Response) => orderControllers.createOrder(req, res, prisma));
router.put("/order", (req: Request, res: Response) => orderControllers.orderConfirmation(req, res, prisma));
router.put("/user/block", (req: Request, res: Response) => userControllers.blockUser(req, res, prisma));
router.post("/food", (req: Request, res: Response) => foodControllers.createFood(req, res, prisma));
router.get("/order/confirmation", (req: Request, res: Response) => orderControllers.showOrders(req, res, prisma));



export default router;
