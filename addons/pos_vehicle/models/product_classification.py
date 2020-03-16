from odoo import api, fields, models, tools, _

class PosCategory(models.Model):
    _name = "product.classification"
    _description = "Product Classification"
    _order = "sequence, name"

    @api.constrains('parent_id')
    def _check_classification_recursion(self):
        if not self._check_recursion():
            raise ValueError(_('Error ! You cannot create recursive categories.'))

    name = fields.Char(required=True, translate=True)
    parent_id = fields.Many2one('product.classification', string='Parent Classification', index=True)
    child_id = fields.One2many('product.classification', 'parent_id', string='Children Classification')
    sequence = fields.Integer(help="Gives the sequence order when displaying a list of products in report.")
    remove_trailing_zeros=fields.Boolean("Remove Trailing Zeros in report")  
    width=fields.Integer("Max Width in Reports")
 

    @api.multi
    def name_get(self):
        def get_names(cat):
            res = []
            while cat:
                res.append(cat.name)
                cat = cat.parent_id
            return res
        return [(cat.id, " / ".join(reversed(get_names(cat)))) for cat in self]


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    product_classification_id=fields.Many2one('product.classification', string='Parent Classification')
