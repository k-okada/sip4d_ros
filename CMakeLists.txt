cmake_minimum_required(VERSION 3.5...3.99)
project(sip4d_ros)

# Set CMake policies to suppress warnings
if(POLICY CMP0148)
  cmake_policy(SET CMP0148 OLD)
endif()

find_package(catkin REQUIRED)

catkin_package()

# Install scripts
catkin_install_python(PROGRAMS
  scripts/bag2sip4d_converter.py
  DESTINATION ${CATKIN_PACKAGE_BIN_DESTINATION}
)

# Install launch files
install(DIRECTORY launch/
  DESTINATION ${CATKIN_PACKAGE_SHARE_DESTINATION}/launch
)
