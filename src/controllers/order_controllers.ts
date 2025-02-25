import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { endOfDay, startOfDay } from "date-fns";

const createOrder = async (req: Request, res: Response, prisma: PrismaClient) => {
    const { order, hour, userId, notes } = req.body;

    try {
        if(await prisma.user.findUnique({where:{id:parseInt(userId),blocked:true}})!=null){
            res.status(400).json({valid:false, message: "User is blocked"});
            return;
        }
        const foodPrices = await prisma.food.findMany({
            where: {
                id: { in: order.map((food: { id: any }) => parseInt(food.id)) }
            },
            select: {
                id: true,
                price: true
            }
        });

        const priceMap = new Map(foodPrices.map(food => [food.id, food.price]));

        let totalPrice = order.reduce((sum: number, food: { id: any; quantity: any }) => {
            return sum + (priceMap.get(food.id) || 0) * food.quantity;
        }, 0);

        // Transacción para garantizar exclusividad
        const newOrder = await prisma.$transaction(async (tx) => {
            // Bloquea la fila del contador y obtiene el último número
            const counter = await tx.orderCounter.update({
                where: { id: 1 },
                data: { number: { increment: 1 } },
                select: { number: true }
            });

            const newNumber = (counter.number % 100) || 1;

            return await tx.pedido.create({
                data: {
                    number: newNumber,
                    hour,
                    total: totalPrice,
                    userId:parseInt(userId),
                    notes: notes || null,
                    status: "PENDING",
                    food_pedido: {
                        create: order.map((food: { id: any; quantity: any }) => ({
                            quantity: food.quantity,
                            foodId: food.id,
                            price: priceMap.get(food.id) || 0  
                        }))
                    }
                }
            });
        });

        res.status(200).json({ valid: true, order, message: "Order created successfully", data: newOrder.number });
        return
    } catch (error) {
        console.error(error);
        res.status(500).json({ valid: false, message: "Error creating order", data: error });
        return
    }
};

const orderConfirmation = async (req: Request, res: Response, prisma: PrismaClient) => {
    const { orderId, status, userId } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId, role: "ADMIN" }
        });
        if (!user) {
            res.status(404).json({ valid: false, message: "User is not admin" });
            return
            
        }
        const order = await prisma.pedido.update({
            where: { id: orderId },
            data: { status: status }
        });

         res.status(200).json({ valid: true, message: "Order status changed successfully", data: order });
         return
    } catch (error) {
        console.error(error);
        res.status(500).json({ valid: false, message: "Error confirming order", data: error });
        return
    }
}

const showOrders = async (req: Request, res: Response, prisma: PrismaClient) => {
    const { userId } = req.body;
    const todayStart = startOfDay(new Date()); // Primer momento del día
  const todayEnd = endOfDay(new Date()); // Último momento del día

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId, role: "ADMIN" }
        });
        if (!user) {
            res.status(404).json({ valid: false, message: "User is not admin" });
            return
        }
        const orders = await prisma.pedido.findMany({
            where: { status: "PENDING"
                ,OR: [
                    {
                        createdAt: {
                            gte: todayStart,
                            lte: todayEnd
                        }
                    },
                    {
                        hour: {
                            gte: todayStart,
                            lte: todayEnd
                        }
                    }
                ]},
            include: {
                user: {
                    omit:{
                        createdAt: true,
                        modifyAt: true,
                        password: true,
                        blocked: true,
                        role: true,

                    }
                },
                food_pedido: {
                    omit:{
                        createdAt: true,
                        modifyAt: true,
                        
                        id: true
                    },
                    include: {
                        food: {omit:{
                            createdAt: true,
                            modifyAt: true,

                        }}
                    }
                }
            }
        });

        res.status(200).json({ valid: true, message: "Orders retrieved successfully", data: orders });
        return
    } catch (error) {
        console.error(error);
        res.status(500).json({ valid: false, message: "Error retrieving orders", data: error });
        return
    }
}

const showOrdersConfirmed = async (req: Request, res: Response, prisma: PrismaClient) => {
    const { userId } = req.body;
    const todayStart = startOfDay(new Date()); // Primer momento del día
  const todayEnd = endOfDay(new Date()); // Último momento del día

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId, role: "ADMIN" }
        });
        if (!user) {
            res.status(404).json({ valid: false, message: "User is not admin" });
            return
        }
        const orders = await prisma.pedido.findMany({
            where: { status: "CONFIRMED"
                ,hour:{
                gte: todayStart,
                lte: todayEnd
            }},
            include: {
                user: {
                    omit:{
                        createdAt: true,
                        modifyAt: true,
                        password: true,
                        blocked: true,
                        role: true,

                    }
                },
                food_pedido: {
                    omit:{
                        createdAt: true,
                        modifyAt: true,
                        
                        id: true
                    },
                    include: {
                        food: {omit:{
                            createdAt: true,
                            modifyAt: true,

                        }}
                    }
                }
            }
        });

        res.status(200).json({ valid: true, message: "Orders retrieved successfully", data: orders });
        return
    } catch (error) {
        console.error(error);
        res.status(500).json({ valid: false, message: "Error retrieving orders", data: error });
        return
    }
}

const showOrdersFromUser = async (req: Request, res: Response, prisma: PrismaClient) => {
    const { userId } = req.body;
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    try {
        const user = await prisma.user.findMany({
            where: { id: parseInt(userId), blocked: false, pedido: { some: { hour: { gte: todayStart, lte: todayEnd } } } }
        });
        if (!user) {
            res.status(404).json({ valid: false, message: "User is not user" });
            return
        }
        const orders = await prisma.pedido.findMany({
            where: {
                userId: parseInt(userId),
                OR: [
                    {
                        createdAt: {
                            gte: todayStart,
                            lte: todayEnd
                        }
                    },
                    {
                        hour: {
                            gte: todayStart,
                            lte: todayEnd
                        }
                    }
                ]
            },
            orderBy: { hour: "desc" },

            include: {
                user: {
                    omit:{
                        createdAt: true,
                        modifyAt: true,
                        password: true,
                        blocked: true,
                        role: true,

                    }
                },
                food_pedido: {
                    omit:{
                        createdAt: true,
                        modifyAt: true,
                        
                        id: true
                    },
                    include: {
                        food: {omit:{
                            createdAt: true,
                            modifyAt: true,

                        }}
                    }
                }
            }
        });

        res.status(200).json({ valid: true, message: "Orders retrieved successfully", data: orders });
        return
    } catch (error) {
        console.error(error);
        res.status(500).json({ valid: false, message: "Error retrieving orders", data: error });
        return
    }
}

const getBalance = async (req: Request, res: Response, prisma: PrismaClient) => {
    // Calcula la fecha de hace 7 días
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
    prisma.pedido.findMany({
      where: { 
        status: "DELIVERED", 
        hour: { 
          lte: new Date(),
          gte: sevenDaysAgo
        } 
      },
      select: { total: true, hour: true }
    })
    .then((data) => {
      // Agrupa los pedidos por día (formateado como "YYYY-MM-DD")
      const grouped = data.reduce((acc, order) => {
        const day = new Date(order.hour).toISOString().slice(0, 10);
        if (!acc[day]) {
          acc[day] = { quantity: 0, balance: 0 };
        }
        acc[day].quantity++;
        acc[day].balance += order.total;
        return acc;
      }, {} as Record<string, { quantity: number, balance: number }>);
  
      // Transforma el objeto agrupado en un array de objetos
      const result = Object.entries(grouped).map(([day, stats]) => ({
        day,
        ...stats
      }));
  
      res.status(200).json({ valid: true, data: result });
    })
    .catch((error) => {
      res.status(500).json({ valid: false, message: "Error getting balance", data: error });
    });
  }
  

export const orderControllers = {
    showOrdersFromUser,
    createOrder,
    orderConfirmation,
    showOrders,
    showOrdersConfirmed,
    getBalance
}