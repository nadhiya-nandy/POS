from odoo import models,fields,api,tools

_logger=logging.getLogger(__name__)

class InheritProductOrders(models.Model):
    _name='product.order'
    _inherit='pos.order'

    lines=fields.One2many('pos.order.line','order_id',string="order line",readonly=True , copy=True)

class InheritProductOrderLine(models.Model):
    _name="product.order.line"
    _inherit="pos.order.line"

    order_id=fields.Many2one('product.order',string="Order Reference",ondelete=cascade)
