# -*- coding: utf-8 -*-
from odoo import http

# class PaSales(http.Controller):
#     @http.route('/pa__sales/pa__sales/', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/pa__sales/pa__sales/objects/', auth='public')
#     def list(self, **kw):
#         return http.request.render('pa__sales.listing', {
#             'root': '/pa__sales/pa__sales',
#             'objects': http.request.env['pa__sales.pa__sales'].search([]),
#         })

#     @http.route('/pa__sales/pa__sales/objects/<model("pa__sales.pa__sales"):obj>/', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('pa__sales.object', {
#             'object': obj
#         })