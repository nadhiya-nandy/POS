# -*- coding: utf-8 -*-
from odoo import http

# class PosVehicle(http.Controller):
#     @http.route('/pos_vehicle/pos_vehicle/', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/pos_vehicle/pos_vehicle/objects/', auth='public')
#     def list(self, **kw):
#         return http.request.render('pos_vehicle.listing', {
#             'root': '/pos_vehicle/pos_vehicle',
#             'objects': http.request.env['pos_vehicle.pos_vehicle'].search([]),
#         })

#     @http.route('/pos_vehicle/pos_vehicle/objects/<model("pos_vehicle.pos_vehicle"):obj>/', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('pos_vehicle.object', {
#             'object': obj
#         })