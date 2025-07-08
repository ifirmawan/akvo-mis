import os
import tempfile
import unittest
from unittest.mock import patch, MagicMock
from docx import Document
from docx.shared import Inches

from utils.report_generator import (
    generate_datapoint_report,
    safe_set_cell_text,
    is_image_path,
    is_photo_question,
    get_full_image_path,
    add_images_to_cell
)


class TestReportGeneration(unittest.TestCase):
    """Test suite for report generation functions using static JSON data"""

    def setUp(self):
        """Set up test fixtures with static data"""
        self.temp_dir = tempfile.mkdtemp()
        self.test_file_path = os.path.join(self.temp_dir, "test_report.docx")

    def tearDown(self):
        """Clean up temporary files"""
        if os.path.exists(self.test_file_path):
            os.remove(self.test_file_path)
        os.rmdir(self.temp_dir)

    def test_basic_table_generation(self):
        """Test basic table generation with simple data structure"""
        report_data = [
            {
                "name": "Basic Information",
                "questions": [
                    {
                        "question": "Village Name",
                        "answers": ["Test Village"]
                    },
                    {
                        "question": "Population",
                        "answers": ["1500"]
                    },
                    {
                        "question": "District",
                        "answers": ["Test District"]
                    }
                ]
            }
        ]

        result_path = generate_datapoint_report(
            report_data,
            file_path=self.test_file_path,
            form_name="Basic Test Report"
        )

        # Verify file was created
        self.assertTrue(os.path.exists(result_path))
        self.assertEqual(result_path, self.test_file_path)

        # Load and verify document structure
        doc = Document(result_path)

        # Should have at least one table
        self.assertGreater(len(doc.tables), 0)

        # First table should have the basic questions
        table = doc.tables[0]
        self.assertGreater(len(table.rows), 3)  # Header + 3 questions

    def test_multi_column_answers(self):
        """Test handling multiple answers across columns"""
        report_data = [
            {
                "name": "Water Quality Tests",
                "questions": [
                    {
                        "question": "pH Level",
                        "answers": ["7.2", "7.5", "7.1"]
                    },
                    {
                        "question": "Chlorine Level",
                        "answers": ["0.5", "0.6", "0.4"]
                    },
                    {
                        "question": "Temperature",
                        "answers": ["22°C", "23°C", "21°C"]
                    }
                ]
            }
        ]

        result_path = generate_datapoint_report(
            report_data,
            file_path=self.test_file_path,
            form_name="Multi-Column Test"
        )

        self.assertTrue(os.path.exists(result_path))

        # Load document and verify structure
        doc = Document(result_path)
        table = doc.tables[0]

        # Should have 4 columns (1 question + 3 answers)
        self.assertEqual(len(table.rows[1].cells), 4)  # Skip header row

    def test_multi_table_splitting(self):
        """Test data splitting across multiple tables when >5 answers"""
        report_data = [
            {
                "name": "Large Dataset",
                "questions": [
                    {
                        "question": "Sample ID",
                        "answers": [
                            "S001", "S002", "S003", "S004",
                            "S005", "S006", "S007"
                        ]
                    },
                    {
                        "question": "Result",
                        "answers": [
                            "Pass", "Pass", "Fail", "Pass",
                            "Pass", "Pass", "Fail"
                        ]
                    }
                ]
            }
        ]

        result_path = generate_datapoint_report(
            report_data,
            file_path=self.test_file_path,
            form_name="Multi-Table Test"
        )

        self.assertTrue(os.path.exists(result_path))

        # Load document and verify multiple tables were created
        doc = Document(result_path)
        self.assertGreater(len(doc.tables), 1)  # Should have at least 2 tables

        # First table should have 6 columns (1 question + 5 answers)
        first_table = doc.tables[0]
        self.assertEqual(len(first_table.rows[1].cells), 6)

    def test_coordinate_formatting(self):
        """Test special handling of latitude/longitude coordinates"""
        report_data = [
            {
                "name": "Location Data",
                "questions": [
                    {
                        "question": "Site Name",
                        "answers": ["Site A", "Site B"]
                    },
                    {
                        "question": "Latitude",
                        "answers": ["12.3456", "12.7890"]
                    },
                    {
                        "question": "Longitude",
                        "answers": ["78.9012", "78.5432"]
                    },
                    {
                        "question": "Elevation",
                        "answers": ["150m", "200m"]
                    }
                ]
            }
        ]

        result_path = generate_datapoint_report(
            report_data,
            file_path=self.test_file_path,
            form_name="Coordinate Test"
        )

        self.assertTrue(os.path.exists(result_path))

        # Load document and verify coordinate formatting
        doc = Document(result_path)
        table = doc.tables[0]

        # Find coordinates row
        coord_row_found = False
        for row in table.rows:
            if len(row.cells) > 0 and "Coordinates" in row.cells[0].text:
                coord_row_found = True
                # Should contain formatted lat,lon pairs
                self.assertIn("12.3456, 78.9012", row.cells[1].text)
                self.assertIn("12.7890, 78.5432", row.cells[2].text)
                break

        self.assertTrue(coord_row_found, "Coordinates row not found in table")

    @patch('utils.report_generator.os.path.exists')
    @patch('utils.report_generator.get_full_image_path')
    def test_image_handling_with_valid_paths(self, mock_get_path, mock_exists):
        """Test handling of image/photo questions with valid image paths"""
        # Mock image file existence
        mock_exists.return_value = True
        mock_get_path.side_effect = lambda x: f"/storage/{x}"

        report_data = [
            {
                "name": "Visual Documentation",
                "questions": [
                    {
                        "question": "Photo of Water Source",
                        "answers": ["/images/water1.jpg", "/images/water2.png"]
                    },
                    {
                        "question": "Site Image",
                        "answers": ["/images/site1.jpg"]
                    },
                    {
                        "question": "Description",
                        "answers": ["Clear water", "Good condition"]
                    }
                ]
            }
        ]

        with patch('utils.report_generator.add_images_to_cell') as mock_images:
            result_path = generate_datapoint_report(
                report_data,
                file_path=self.test_file_path,
                form_name="Image Test"
            )

            self.assertTrue(os.path.exists(result_path))

            # Verify images were processed
            self.assertGreater(mock_images.call_count, 0)

    def test_image_handling_with_missing_files(self):
        """Test handling of image questions when image files don't exist"""
        report_data = [
            {
                "name": "Missing Images",
                "questions": [
                    {
                        "question": "Photo of Equipment",
                        "answers": [
                            "/images/missing1.jpg", "/images/missing2.png"
                        ]
                    }
                ]
            }
        ]

        # Don't mock file existence - files won't exist
        result_path = generate_datapoint_report(
            report_data,
            file_path=self.test_file_path,
            form_name="Missing Image Test"
        )

        self.assertTrue(os.path.exists(result_path))

        # Document should still be created even with missing images
        doc = Document(result_path)
        self.assertGreater(len(doc.tables), 0)

    def test_empty_data_handling(self):
        """Test handling of empty or null data"""
        report_data = [
            {
                "name": "Empty Data Group",
                "questions": [
                    {
                        "question": "Empty Question",
                        "answers": []
                    },
                    {
                        "question": "Null Values",
                        "answers": [None, "", None]
                    },
                    {
                        "question": "Mixed Values",
                        "answers": ["Valid", None, "", "Another Valid"]
                    }
                ]
            }
        ]

        result_path = generate_datapoint_report(
            report_data,
            file_path=self.test_file_path,
            form_name="Empty Data Test"
        )

        self.assertTrue(os.path.exists(result_path))

        # Load document and verify it handles empty data gracefully
        doc = Document(result_path)
        table = doc.tables[0]

        # Should still create the table structure
        self.assertGreater(len(table.rows), 2)  # Header + questions

    def test_error_handling_invalid_path(self):
        """Test error handling when file path is invalid"""
        report_data = [
            {
                "name": "Test Group",
                "questions": [
                    {
                        "question": "Test Question",
                        "answers": ["Test Answer"]
                    }
                ]
            }
        ]

        # Try to save to a directory that doesn't exist and can't be created
        # Use a path that includes a file as a directory component
        invalid_path = "/etc/passwd/test.docx"  # passwd is a file, not dir

        # Should raise an exception
        with self.assertRaises((OSError, FileNotFoundError, PermissionError)):
            generate_datapoint_report(
                report_data,
                file_path=invalid_path,
                form_name="Error Test"
            )

    def test_village_name_extraction(self):
        """Test extraction of village name for subtitle"""
        report_data = [
            {
                "name": "Location Info",
                "questions": [
                    {
                        "question": "Village Name",
                        "answers": ["Test Village"]
                    },
                    {
                        "question": "Other Info",
                        "answers": ["Some data"]
                    }
                ]
            }
        ]

        result_path = generate_datapoint_report(
            report_data,
            file_path=self.test_file_path,
            form_name="Village Name Test"
        )

        self.assertTrue(os.path.exists(result_path))

        # Village name should be extracted (tested through document creation)
        doc = Document(result_path)
        self.assertGreater(len(doc.tables), 0)

    def test_multiple_village_names(self):
        """Test handling of multiple village names"""
        report_data = [
            {
                "name": "Multi-Village Data",
                "questions": [
                    {
                        "question": "Village Name",
                        "answers": ["Village A", "Village B", "Village C"]
                    },
                    {
                        "question": "Population",
                        "answers": ["1000", "1500", "800"]
                    }
                ]
            }
        ]

        result_path = generate_datapoint_report(
            report_data,
            file_path=self.test_file_path,
            form_name="Multi-Village Test"
        )

        self.assertTrue(os.path.exists(result_path))
        doc = Document(result_path)
        self.assertGreater(len(doc.tables), 0)

    def test_complex_multi_group_scenario(self):
        """Test complex scenario with multiple groups and mixed data types"""
        report_data = [
            {
                "name": "Basic Information",
                "questions": [
                    {
                        "question": "Village Name",
                        "answers": ["Complex Village"]
                    },
                    {
                        "question": "District",
                        "answers": ["Test District"]
                    }
                ]
            },
            {
                "name": "Location Data",
                "questions": [
                    {
                        "question": "Latitude",
                        "answers": ["12.3456", "12.7890"]
                    },
                    {
                        "question": "Longitude",
                        "answers": ["78.9012", "78.5432"]
                    }
                ]
            },
            {
                "name": "Quality Measurements",
                "questions": [
                    {
                        "question": "pH Level",
                        "answers": ["7.2", "7.5", "7.1", "7.3", "7.4", "7.0"]
                    },
                    {
                        "question": "Temperature",
                        "answers": [
                            "22°C", "23°C", "21°C", "24°C", "22°C", "23°C"
                        ]
                    }
                ]
            }
        ]

        result_path = generate_datapoint_report(
            report_data,
            file_path=self.test_file_path,
            form_name="Complex Scenario Test"
        )

        self.assertTrue(os.path.exists(result_path))

        # Load document and verify structure
        doc = Document(result_path)

        # Should have multiple tables due to >5 answers in last group
        self.assertGreater(len(doc.tables), 1)

    def test_professional_formatting(self):
        """Test professional formatting features"""
        report_data = [
            {
                "name": "Formatted Report",
                "questions": [
                    {
                        "question": "Test Question",
                        "answers": ["Test Answer"]
                    }
                ]
            }
        ]

        result_path = generate_datapoint_report(
            report_data,
            file_path=self.test_file_path,
            form_name="Formatting Test Report"
        )

        self.assertTrue(os.path.exists(result_path))

        # Load document and verify basic formatting applied
        doc = Document(result_path)

        # Should have landscape orientation
        section = doc.sections[0]
        self.assertEqual(section.page_width, Inches(11))
        self.assertEqual(section.page_height, Inches(8.5))

        # Should have proper margins
        self.assertEqual(section.top_margin, Inches(1))
        self.assertEqual(section.bottom_margin, Inches(1))
        self.assertEqual(section.left_margin, Inches(1))
        self.assertEqual(section.right_margin, Inches(1))


class TestUtilityFunctions(unittest.TestCase):
    """Test utility functions used in report generation"""

    def test_safe_set_cell_text(self):
        """Test safe_set_cell_text function"""
        # Create a mock row with cells
        mock_row = MagicMock()
        mock_cells = [MagicMock(), MagicMock(), MagicMock()]
        mock_row.cells = mock_cells

        # Test valid column index
        result = safe_set_cell_text(mock_row, 1, "test text")
        self.assertTrue(result)
        self.assertEqual(mock_cells[1].text, "test text")

        # Test invalid column index
        result = safe_set_cell_text(mock_row, 5, "test text")
        self.assertFalse(result)

        # Test None text
        result = safe_set_cell_text(mock_row, 0, None)
        self.assertTrue(result)
        self.assertEqual(mock_cells[0].text, "")

    def test_is_image_path(self):
        """Test is_image_path function"""
        # Valid image paths
        self.assertTrue(is_image_path("test.jpg"))
        self.assertTrue(is_image_path("image.PNG"))
        self.assertTrue(is_image_path("/path/to/image.jpeg"))
        self.assertTrue(is_image_path("photo.gif"))
        self.assertTrue(is_image_path("picture.bmp"))
        self.assertTrue(is_image_path("scan.tiff"))

        # Invalid paths
        self.assertFalse(is_image_path("document.pdf"))
        self.assertFalse(is_image_path("text.txt"))
        self.assertFalse(is_image_path(""))
        self.assertFalse(is_image_path(None))
        self.assertFalse(is_image_path(123))

    def test_is_photo_question(self):
        """Test is_photo_question function"""
        # Photo-related questions
        self.assertTrue(is_photo_question("Take a photo of the site"))
        self.assertTrue(is_photo_question("Upload image"))
        self.assertTrue(is_photo_question("Picture of equipment"))
        self.assertTrue(is_photo_question("Snapshot of results"))
        self.assertTrue(is_photo_question("Site pic"))

        # Non-photo questions
        self.assertFalse(is_photo_question("What is the temperature?"))
        self.assertFalse(is_photo_question("Enter the pH value"))
        self.assertFalse(is_photo_question("Description of site"))

    @patch('utils.report_generator.STORAGE_PATH', '/test/storage')
    def test_get_full_image_path(self):
        """Test get_full_image_path function"""
        # Test with leading slash
        result = get_full_image_path("/images/test.jpg")
        self.assertEqual(result, "/test/storage/images/test.jpg")

        # Test without leading slash
        result = get_full_image_path("images/test.jpg")
        self.assertEqual(result, "/test/storage/images/test.jpg")

        # Test simple filename
        result = get_full_image_path("test.jpg")
        self.assertEqual(result, "/test/storage/test.jpg")

    @patch('utils.report_generator.os.path.exists')
    @patch('utils.report_generator.get_full_image_path')
    def test_add_images_to_cell(self, mock_get_path, mock_exists):
        """Test add_images_to_cell function"""
        # Mock file existence and path
        mock_exists.return_value = True
        mock_get_path.return_value = "/test/storage/test.jpg"

        # Create mock cell
        mock_cell = MagicMock()
        mock_paragraph = MagicMock()
        mock_run = MagicMock()
        mock_cell.paragraphs = [mock_paragraph]
        mock_paragraph.runs = [mock_run]
        mock_cell.add_paragraph.return_value = mock_paragraph

        # Test adding images
        image_paths = ["/images/test1.jpg", "/images/test2.jpg"]
        add_images_to_cell(mock_cell, image_paths)

        # Verify cell text was cleared
        self.assertEqual(mock_cell.text, "")

        # Verify add_picture was called
        self.assertEqual(mock_run.add_picture.call_count, 2)


if __name__ == '__main__':
    unittest.main()
