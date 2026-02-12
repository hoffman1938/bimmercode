-- Parts Finder Seed Data
-- Comprehensive parts database for BMW error codes
-- Version: 1.0

-- =====================================================
-- COMMON ENGINE PARTS
-- =====================================================

-- P0100: MAF Sensor
INSERT INTO error_code_parts VALUES
('part_p0100_001', 'P0100', 'Mass Air Flow Sensor', 'Датчик массового расхода воздуха', 'მასის საჰაერო ნაკადის სენსორი', 'engine', '13627566986', 'BMW', 1, 150.00, 200.00, 'USD', 1, 'E46, E90, E60, F10, F30', 'medium', 0.5, 24, 'OEM BMW MAF sensor', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0100_002', 'P0100', 'Mass Air Flow Sensor', 'Датчик массового расхода воздуха', 'მასის საჰაერო ნაკადის სენსორი', 'engine', '0280218190', 'Bosch', 0, 90.00, 120.00, 'USD', 1, 'E46, E90, E60', 'medium', 0.5, 12, 'Bosch aftermarket MAF', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0100_003', 'P0100', 'Air Filter', 'Воздушный фильтр', 'ჰაერის ფილტრი', 'engine', '13717521033', 'BMW', 1, 25.00, 35.00, 'USD', 2, 'E90, E60, F10', 'easy', 0.2, 12, 'Replace with MAF sensor', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0100_004', 'P0100', 'MAF Sensor Cleaner', 'Очиститель MAF', 'MAF გამწმენდი', 'maintenance', 'CRC05110', 'CRC', 0, 8.00, 12.00, 'USD', 3, 'Universal', 'easy', 0.1, NULL, 'Try cleaning first', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- P0171: System Too Lean
INSERT INTO error_code_parts VALUES
('part_p0171_001', 'P0171', 'Oxygen Sensor (Bank 1)', 'Датчик кислорода', 'ჟანგბადის სენსორი', 'engine', '11787558055', 'BMW', 1, 80.00, 120.00, 'USD', 1, 'E90, E60, F10', 'medium', 1.0, 24, 'Upstream O2 sensor', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0171_002', 'P0171', 'Oxygen Sensor', 'Датчик кислорода', 'ჟანგბადის სენსორი', 'engine', '0258017025', 'Bosch', 0, 45.00, 65.00, 'USD', 1, 'E90, E60', 'medium', 1.0, 12, 'Bosch universal O2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0171_003', 'P0171', 'Vacuum Hose Kit', 'Комплект вакуумных шлангов', 'ვაკუუმის შლანგების კომპლექტი', 'engine', '11617501562', 'BMW', 1, 30.00, 50.00, 'USD', 2, 'E90, E60', 'medium', 1.5, 12, 'Check for leaks', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0171_004', 'P0171', 'Fuel Filter', 'Топливный фильтр', 'საწვავის ფილტრი', 'fuel', '16117222391', 'BMW', 1, 25.00, 35.00, 'USD', 2, 'E90, E60, F10', 'medium', 0.5, 12, 'Replace if old', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- P0300: Random Misfire
INSERT INTO error_code_parts VALUES
('part_p0300_001', 'P0300', 'Ignition Coil (Set of 6)', 'Катушки зажигания (комплект)', 'ანთების ხვეულები', 'ignition', '12137594937', 'BMW', 1, 300.00, 400.00, 'USD', 1, 'E90 N52, E60 N52', 'medium', 2.0, 24, 'Replace all coils', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0300_002', 'P0300', 'Ignition Coil (Single)', 'Катушка зажигания', 'ანთების ხვეული', 'ignition', '12137594937', 'BMW', 1, 50.00, 70.00, 'USD', 1, 'E90, E60', 'easy', 0.3, 24, 'Per cylinder', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0300_003', 'P0300', 'Spark Plugs (Set of 6)', 'Свечи зажигания', 'სანთლები', 'ignition', '12120037607', 'BMW', 1, 60.00, 80.00, 'USD', 1, 'E90 N52, E60 N52', 'easy', 1.0, 12, 'NGK or BMW OEM', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0300_004', 'P0300', 'Spark Plugs', 'Свечи зажигания', 'სანთლები', 'ignition', 'PLZFR6A-11', 'NGK', 0, 40.00, 55.00, 'USD', 1, 'E90, E60', 'easy', 1.0, 12, 'Aftermarket NGK', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- P0420: Catalyst Efficiency
INSERT INTO error_code_parts VALUES
('part_p0420_001', 'P0420', 'Catalytic Converter', 'Катализатор', 'კატალიზატორი', 'exhaust', '18307812281', 'BMW', 1, 800.00, 1200.00, 'USD', 1, 'E90 335i, E60 535i', 'hard', 3.0, 24, 'Professional installation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0420_002', 'P0420', 'Oxygen Sensor (Post-Cat)', 'Датчик кислорода после катализатора', 'ჟანგბადის სენსორი კატალიზატორის შემდეგ', 'exhaust', '11787558055', 'BMW', 1, 80.00, 120.00, 'USD', 2, 'E90, E60', 'medium', 1.0, 24, 'Try replacing sensor first', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 102613: Fuel Injector
INSERT INTO error_code_parts VALUES
('part_102613_001', '102613', 'Fuel Injector Cylinder 1', 'Форсунка цилиндра 1', 'საწვავის ინჟექტორი ცილინდრი 1', 'fuel', '13537585261', 'BMW', 1, 180.00, 220.00, 'USD', 1, 'E90 335i, E60 535i, F10 535i', 'medium', 1.5, 24, 'N54/N55 engines', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_102613_002', '102613', 'Fuel Injector', 'Форсунка', 'საწვავის ინჟექტორი', 'fuel', '0280158117', 'Bosch', 0, 100.00, 130.00, 'USD', 1, 'E90 335i, E60 535i', 'medium', 1.5, 12, 'Bosch remanufactured', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_102613_003', '102613', 'Injector Seal Ring', 'Уплотнительное кольцо форсунки', 'ინჟექტორის ბეჭედი', 'fuel', '13641435991', 'BMW', 1, 5.00, 10.00, 'USD', 2, 'All models', 'easy', 0.2, NULL, 'Replace when changing injector', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_102613_004', '102613', 'Fuel Filter', 'Топливный фильтр', 'საწვავის ფილტრი', 'fuel', '16117222391', 'BMW', 1, 25.00, 35.00, 'USD', 2, 'E90, E60, F10', 'medium', 0.5, 12, 'Recommended replacement', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- P0401: EGR Flow Insufficient
INSERT INTO error_code_parts VALUES
('part_p0401_001', 'P0401', 'EGR Valve', 'Клапан EGR', 'EGR სარქველი', 'emissions', '11717805757', 'BMW', 1, 200.00, 280.00, 'USD', 1, 'E90 320d, E60 520d', 'medium', 2.0, 24, 'Diesel models', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0401_002', 'P0401', 'EGR Cooler', 'Охладитель EGR', 'EGR გამაგრილებელი', 'emissions', '11717804384', 'BMW', 1, 350.00, 450.00, 'USD', 2, 'E90 320d, E60 520d', 'hard', 3.0, 24, 'May need replacement', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0401_003', 'P0401', 'EGR Valve Gasket', 'Прокладка клапана EGR', 'EGR სარქველის прокладка', 'emissions', '11717805758', 'BMW', 1, 15.00, 25.00, 'USD', 2, 'All diesel', 'easy', 0.5, NULL, 'Replace with valve', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- P0128: Coolant Thermostat
INSERT INTO error_code_parts VALUES
('part_p0128_001', 'P0128', 'Thermostat', 'Термостат', 'თერმოსტატი', 'cooling', '11537549476', 'BMW', 1, 60.00, 90.00, 'USD', 1, 'E90, E60, F10', 'medium', 1.5, 24, 'Includes housing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0128_002', 'P0128', 'Coolant Temperature Sensor', 'Датчик температуры охлаждающей жидкости', 'გამაგრილებელი სითხის ტემპერატურის სენსორი', 'cooling', '12621427953', 'BMW', 1, 25.00, 40.00, 'USD', 2, 'E90, E60', 'easy', 0.5, 24, 'Check sensor first', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0128_003', 'P0128', 'Coolant (1 Gallon)', 'Антифриз', 'ანტიფრიზი', 'cooling', '82141467704', 'BMW', 1, 20.00, 30.00, 'USD', 2, 'All models', 'easy', 0.3, NULL, 'BMW Blue coolant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- P0505: Idle Control System
INSERT INTO error_code_parts VALUES
('part_p0505_001', 'P0505', 'Idle Control Valve', 'Клапан холостого хода', 'უქმი სვლის სარქველი', 'engine', '13411433626', 'BMW', 1, 80.00, 120.00, 'USD', 1, 'E46, E90', 'medium', 1.0, 24, 'M54/N52 engines', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0505_002', 'P0505', 'Throttle Body', 'Дроссельная заслонка', 'დროსელის სხეული', 'engine', '13547524879', 'BMW', 1, 250.00, 350.00, 'USD', 2, 'E90, E60', 'medium', 2.0, 24, 'If cleaning doesn''t help', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0505_003', 'P0505', 'Throttle Body Cleaner', 'Очиститель дросселя', 'დროსელის გამწმენდი', 'maintenance', 'CRC05078', 'CRC', 0, 8.00, 12.00, 'USD', 3, 'Universal', 'easy', 0.2, NULL, 'Try cleaning first', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- P0011: Camshaft Position Timing
INSERT INTO error_code_parts VALUES
('part_p0011_001', 'P0011', 'VANOS Solenoid (Intake)', 'Соленоид VANOS впуск', 'VANOS სოლენოიდი', 'engine', '11367585425', 'BMW', 1, 100.00, 150.00, 'USD', 1, 'E90 N52, E60 N52', 'medium', 1.5, 24, 'Intake side', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0011_002', 'P0011', 'VANOS Solenoid Filter', 'Фильтр соленоида VANOS', 'VANOS ფილტრი', 'engine', '11427525333', 'BMW', 1, 15.00, 25.00, 'USD', 2, 'E90, E60', 'easy', 0.5, NULL, 'Replace with solenoid', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0011_003', 'P0011', 'Engine Oil (5W-30)', 'Моторное масло', 'ძრავის ზეთი', 'maintenance', '83212365950', 'BMW', 1, 40.00, 60.00, 'USD', 2, 'All models', 'easy', 0.5, NULL, 'Use correct oil', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- =====================================================
-- TRANSMISSION PARTS
-- =====================================================

-- P0700: Transmission Control System
INSERT INTO error_code_parts VALUES
('part_p0700_001', 'P0700', 'Transmission Fluid (1L)', 'Трансмиссионное масло', 'ტრანსმისიის ზეთი', 'transmission', '83222339719', 'BMW', 1, 25.00, 35.00, 'USD', 1, 'All automatic', 'medium', 1.0, NULL, 'ZF Lifeguard 6', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0700_002', 'P0700', 'Transmission Filter Kit', 'Фильтр АКПП', 'ტრანსმისიის ფილტრი', 'transmission', '24117571227', 'BMW', 1, 80.00, 120.00, 'USD', 2, 'E90, E60 automatic', 'hard', 3.0, NULL, 'With fluid change', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0700_003', 'P0700', 'Transmission Pan Gasket', 'Прокладка поддона АКПП', 'ტრანსმისიის პანის ბეჭედი', 'transmission', '24117571217', 'BMW', 1, 30.00, 45.00, 'USD', 2, 'All automatic', 'medium', 2.0, NULL, 'Replace with filter', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- P0730: Incorrect Gear Ratio
INSERT INTO error_code_parts VALUES
('part_p0730_001', 'P0730', 'Mechatronic Sleeve', 'Гильза мехатроника', 'მექატრონიკის სამარჯვე', 'transmission', '24347571227', 'BMW', 1, 150.00, 200.00, 'USD', 1, 'E90, E60, F10 automatic', 'hard', 4.0, 24, 'Common ZF6HP failure', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_p0730_002', 'P0730', 'Transmission Solenoid Kit', 'Комплект соленоидов АКПП', 'ტრანსმისიის სოლენოიდები', 'transmission', '24347588724', 'BMW', 1, 300.00, 450.00, 'USD', 2, 'ZF6HP transmissions', 'hard', 5.0, 24, 'Professional install', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- =====================================================
-- ABS/BRAKE PARTS
-- =====================================================

-- 5F00: ABS Pump Motor
INSERT INTO error_code_parts VALUES
('part_5f00_001', '5F00', 'ABS Pump Motor', 'Мотор насоса ABS', 'ABS ტუმბოს ძრავა', 'brakes', '34516791416', 'BMW', 1, 400.00, 600.00, 'USD', 1, 'E90, E60', 'hard', 3.0, 24, 'Common failure', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_5f00_002', '5F00', 'ABS Module (Remanufactured)', 'Блок ABS восстановленный', 'ABS მოდული', 'brakes', '34516791416R', 'Bosch', 0, 250.00, 350.00, 'USD', 1, 'E90, E60', 'hard', 3.0, 12, 'Reman option', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_5f00_003', '5F00', 'Brake Fluid (1L)', 'Тормозная жидкость', 'სამუხრუჭე სითხე', 'brakes', '83132405977', 'BMW', 1, 15.00, 25.00, 'USD', 2, 'All models', 'easy', 0.5, NULL, 'DOT 4 LV', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 5DF0: Wheel Speed Sensor
INSERT INTO error_code_parts VALUES
('part_5df0_001', '5DF0', 'Wheel Speed Sensor Front', 'Датчик скорости колеса передний', 'წინა ბორბლის სიჩქარის სენსორი', 'brakes', '34526756375', 'BMW', 1, 40.00, 60.00, 'USD', 1, 'E90, E60', 'easy', 0.5, 24, 'Front left/right', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('part_5df0_002', '5DF0', 'Wheel Speed Sensor Rear', 'Датчик скорости колеса задний', 'უკანა ბორბლის სიჩქარის სენსორი', 'brakes', '34526756376', 'BMW', 1, 40.00, 60.00, 'USD', 1, 'E90, E60', 'easy', 0.5, 24, 'Rear left/right', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Continue with more parts...
-- This is a comprehensive starter set covering the most common error codes
-- Additional parts can be added through admin panel or API
