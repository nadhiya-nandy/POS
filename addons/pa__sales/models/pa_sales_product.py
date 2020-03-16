# -*- coding: utf-8 -*
from odoo import models, fields, api


class SalesProduct(models.Model):
    _name = 'sales.product'
    _description = 'Product Sales'
    _order = 'product_type'

    sales_product_id = fields.Many2one('product.template', string="Product", required=True)
    product_id = fields.Many2one('product.template', string="Product", required=True)
    product_quantity = fields.Float(string="Quantity", default=1.0)
    product_type = fields.Selection([('variable', 'Variable') ,('fixed', 'Fixed'),], string="Type",default="variable", required=True)
    sequence = fields.Integer(string='Sequence', default=5)

class SalesOrder(models.Model):
    _inherit = 'product.template'
    favorite=fields.Float()
    is_combo = fields.Boolean(string="Is Combo Product?")
    remove_trailing_zeros = fields.Boolean(string="Remove trailing zeros in reports?")
    sales_product_ids = fields.One2many('sales.product', 'sales_product_id', string="Combo Product")
    @api.model
    def products_sort(self,product_id):
        product=self.env['product.template'].search([('id' , '=' , product_id)])
        product.update({'favourite':product.favourite+1})
        return product.favourite

class SalesSequence(models.Model):
    _inherit = "pos.order.line"
    sequence = fields.Integer(string='Sequence')

class ProductStock(models.Model):
    _inherit = 'res.company'

    tin = fields.Char("TIN")
